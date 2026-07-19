/**
 * The editor's AI assistant (Route Studio phase 4): a conversational
 * layer over the open itinerary with two server functions —
 *
 * - `adviseItineraryChange` — sends the conversation + the itinerary's
 *   current state to the provider and returns a structured answer: a
 *   reply, plus optionally a *proposed* patch (Zod-validated ops, see
 *   domain/ai-patch.ts). Free: browsing/asking never consumes quota, and
 *   nothing is written.
 * - `applyItineraryPatch` — applies a previewed patch transactionally
 *   (author-only, ops re-validated, day/stop invariants preserved) and
 *   consumes one generation of the shared daily AI quota (`ai_generation`
 *   row — same 5/day pool as /new's draft generation).
 *
 * Conversation state lives on the client (no chat persistence in v1 —
 * plan decision); the provider key gating and retry semantics mirror
 * ai.ts.
 */
import { z } from 'zod'
import { NoObjectGeneratedError, generateObject } from 'ai'
import { createGoogle } from '@ai-sdk/google'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { db as appDb } from '#/db'
import { env } from '#/env'
import type * as schema from '#/db/schema'
import { aiGeneration, itinerary, itineraryDay, stop } from '#/db/schema'
import { getLocale } from '#/paraglide/runtime'
import { AI_DAILY_GENERATION_LIMIT } from '#/server/ai'
import {
  assistantResponseSchema,
  buildAssistantPrompt,
  patchOpsSchema,
  serializeItineraryState,
} from '#/server/domain/ai-patch'
import type { AssistantResponse } from '#/server/domain/ai-patch'
import {
  ERR_AI_GENERATION_FAILED,
  ERR_AI_PATCH_INVALID,
  ERR_AI_QUOTA_EXCEEDED,
} from '#/server/errors'
import type { SessionUser } from '#/server/itineraries'
import { getSessionOrThrow } from '#/server/context'
import { requireItineraryAuthor } from '#/server/shared'

type Database = NodePgDatabase<typeof schema>

const ASSISTANT_MODEL = 'gemini-2.5-flash'
const ASSISTANT_TIMEOUT_MS = 45_000

/** Duplicated from ai.ts (module-private there): quota rows since UTC midnight. */
async function countTodayGenerations(
  db: Database,
  userId: string,
): Promise<number> {
  const now = new Date()
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiGeneration)
    .where(
      and(eq(aiGeneration.userId, userId), gte(aiGeneration.createdAt, dayStart)),
    )
  return row.count
}

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
})

const adviseSchema = z.object({
  itineraryId: z.string().min(1),
  /** Client-held transcript, newest last; capped to keep prompts bounded. */
  messages: z.array(chatMessageSchema).min(1).max(16),
})

export type AdviseItineraryChangeInput = z.infer<typeof adviseSchema> & {
  locale: string
}

async function loadAssistantState(db: Database, itineraryId: string) {
  const [row] = await db
    .select({
      title: itinerary.title,
      summary: itinerary.summary,
      destination: itinerary.destination,
      currency: itinerary.currency,
    })
    .from(itinerary)
    .where(eq(itinerary.id, itineraryId))
  const days = await db.query.itineraryDay.findMany({
    where: eq(itineraryDay.itineraryId, itineraryId),
    orderBy: asc(itineraryDay.dayNumber),
  })
  const dayIds = days.map((d) => d.id)
  const stops = dayIds.length
    ? await db.query.stop.findMany({
        where: inArray(stop.dayId, dayIds),
        orderBy: asc(stop.position),
      })
    : []
  const stopsByDay = new Map<string, typeof stops>()
  for (const s of stops) {
    const list = stopsByDay.get(s.dayId) ?? []
    list.push(s)
    stopsByDay.set(s.dayId, list)
  }
  return serializeItineraryState({
    title: row.title,
    summary: row.summary,
    destination: row.destination,
    currency: row.currency,
    days: days.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      note: day.note,
      stops: (stopsByDay.get(day.id) ?? []).map((s, index) => ({
        position: index + 1,
        name: s.name,
        category: s.category,
        description: s.description,
        startTime: s.startTime ? s.startTime.slice(0, 5) : null,
        costCents: s.costCents,
      })),
    })),
  })
}

export async function adviseItineraryChangeImpl(
  db: Database,
  session: SessionUser | null,
  input: AdviseItineraryChangeInput,
): Promise<AssistantResponse> {
  await requireItineraryAuthor(db, session, input.itineraryId)

  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(ERR_AI_GENERATION_FAILED)
  }

  const state = await loadAssistantState(db, input.itineraryId)
  const prompt = buildAssistantPrompt({
    state,
    messages: input.messages,
    locale: input.locale,
  })

  const model = createGoogle({ apiKey })(ASSISTANT_MODEL)
  let response: AssistantResponse | null = null
  // Same retry semantics as ai.ts: one retry, and only when the model
  // produced something that just failed schema validation.
  for (let attempt = 0; attempt < 2 && !response; attempt++) {
    try {
      const result = await generateObject({
        model,
        schema: assistantResponseSchema,
        prompt,
        abortSignal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
      })
      response = result.object
    } catch (error) {
      const isRetryableShapeFailure =
        NoObjectGeneratedError.isInstance(error) && attempt === 0
      if (!isRetryableShapeFailure) {
        throw new Error(ERR_AI_GENERATION_FAILED)
      }
    }
  }
  if (!response) {
    throw new Error(ERR_AI_GENERATION_FAILED)
  }
  return response
}

export const adviseItineraryChange = createServerFn({ method: 'POST' })
  .validator(adviseSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return adviseItineraryChangeImpl(appDb, session, {
      ...data,
      locale: getLocale(),
    })
  })

// ---------------------------------------------------------------------------
// applyItineraryPatch
// ---------------------------------------------------------------------------

const applySchema = z.object({
  itineraryId: z.string().min(1),
  ops: patchOpsSchema,
})

export type ApplyItineraryPatchInput = z.infer<typeof applySchema>

/**
 * Applies a previewed patch in one transaction, keeping the manual
 * editor's invariants: day removal renumbers subsequent days, stop
 * removal compacts positions, additions append. Any op referencing a
 * missing day/stop throws AI_PATCH_INVALID and rolls everything back.
 * Consumes one generation of the daily quota on success.
 */
export async function applyItineraryPatchImpl(
  db: Database,
  session: SessionUser | null,
  rawInput: ApplyItineraryPatchInput,
): Promise<void> {
  // Re-validated at the Impl layer (tests call this directly — see the
  // Testability pattern note in itineraries.ts).
  const input = applySchema.parse(rawInput)
  await requireItineraryAuthor(db, session, input.itineraryId)
  const userId = session!.user.id

  const used = await countTodayGenerations(db, userId)
  if (used >= AI_DAILY_GENERATION_LIMIT) {
    throw new Error(ERR_AI_QUOTA_EXCEEDED)
  }

  await db.transaction(async (tx) => {
    // In-memory model of days/stops, mutated alongside the DB so later
    // ops address the evolving state (the contract ops are written for).
    const dayRows = await tx.query.itineraryDay.findMany({
      where: eq(itineraryDay.itineraryId, input.itineraryId),
      orderBy: asc(itineraryDay.dayNumber),
    })
    const dayIds = dayRows.map((d) => d.id)
    const stopRows = dayIds.length
      ? await tx.query.stop.findMany({
          where: inArray(stop.dayId, dayIds),
          orderBy: asc(stop.position),
        })
      : []
    const model = dayRows.map((day) => ({
      id: day.id,
      stops: stopRows
        .filter((s) => s.dayId === day.id)
        .map((s) => ({ id: s.id })),
    }))

    const dayAt = (dayNumber: number) => {
      const day = model.at(dayNumber - 1)
      if (!day) {
        throw new Error(ERR_AI_PATCH_INVALID)
      }
      return day
    }

    for (const op of input.ops) {
      switch (op.op) {
        case 'set_title': {
          await tx
            .update(itinerary)
            .set({ title: op.title })
            .where(eq(itinerary.id, input.itineraryId))
          break
        }
        case 'set_summary': {
          await tx
            .update(itinerary)
            .set({ summary: op.summary })
            .where(eq(itinerary.id, input.itineraryId))
          break
        }
        case 'add_day': {
          const [created] = await tx
            .insert(itineraryDay)
            .values({
              itineraryId: input.itineraryId,
              dayNumber: model.length + 1,
              title: op.title ?? null,
              note: op.note ?? null,
            })
            .returning({ id: itineraryDay.id })
          model.push({ id: created.id, stops: [] })
          break
        }
        case 'update_day': {
          const day = dayAt(op.dayNumber)
          const updates: Partial<typeof itineraryDay.$inferInsert> = {}
          if (op.title !== undefined) updates.title = op.title
          if (op.note !== undefined) updates.note = op.note
          if (Object.keys(updates).length > 0) {
            await tx
              .update(itineraryDay)
              .set(updates)
              .where(eq(itineraryDay.id, day.id))
          }
          break
        }
        case 'remove_day': {
          const day = dayAt(op.dayNumber)
          await tx.delete(itineraryDay).where(eq(itineraryDay.id, day.id))
          model.splice(op.dayNumber - 1, 1)
          for (let i = op.dayNumber - 1; i < model.length; i++) {
            await tx
              .update(itineraryDay)
              .set({ dayNumber: i + 1 })
              .where(eq(itineraryDay.id, model[i].id))
          }
          break
        }
        case 'add_stop': {
          const day = dayAt(op.dayNumber)
          const [created] = await tx
            .insert(stop)
            .values({
              dayId: day.id,
              position: day.stops.length,
              name: op.name,
              category: op.category,
              description: op.description ?? null,
              startTime: op.startTime ?? null,
              costCents: op.costCents ?? null,
            })
            .returning({ id: stop.id })
          day.stops.push({ id: created.id })
          break
        }
        case 'update_stop': {
          const day = dayAt(op.dayNumber)
          const target = day.stops.at(op.position - 1)
          if (!target) {
            throw new Error(ERR_AI_PATCH_INVALID)
          }
          const updates: Partial<typeof stop.$inferInsert> = {}
          if (op.name !== undefined) updates.name = op.name
          if (op.category !== undefined) updates.category = op.category
          if (op.description !== undefined) updates.description = op.description
          if (op.startTime !== undefined) updates.startTime = op.startTime
          if (op.costCents !== undefined) updates.costCents = op.costCents
          if (Object.keys(updates).length > 0) {
            await tx.update(stop).set(updates).where(eq(stop.id, target.id))
          }
          break
        }
        case 'remove_stop': {
          const day = dayAt(op.dayNumber)
          const target = day.stops.at(op.position - 1)
          if (!target) {
            throw new Error(ERR_AI_PATCH_INVALID)
          }
          await tx.delete(stop).where(eq(stop.id, target.id))
          day.stops.splice(op.position - 1, 1)
          for (let i = op.position - 1; i < day.stops.length; i++) {
            await tx
              .update(stop)
              .set({ position: i })
              .where(eq(stop.id, day.stops[i].id))
          }
          break
        }
      }
    }

    // The applied revision consumes one generation of the daily quota.
    await tx.insert(aiGeneration).values({ userId })
  })
}

export const applyItineraryPatch = createServerFn({ method: 'POST' })
  .validator(applySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return applyItineraryPatchImpl(appDb, session, data)
  })
