/**
 * AI itinerary draft generation (design spec:
 * `docs/superpowers/specs/2026-07-19-ai-itinerary-generator-design.md`).
 *
 * Follows the same `*Impl(db, session, input)` / thin `createServerFn`
 * wrapper pattern documented in `itineraries.ts`, plus the two AI sentinels
 * from `./errors` (AI_QUOTA_EXCEEDED / AI_GENERATION_FAILED).
 *
 * Flow: session → quota (5 successful generations per UTC day; failures
 * never consume it) → provider call (`generateObject` against Gemini Flash
 * with a per-request Zod schema that pins the exact day count) → one
 * transaction persisting the draft in the fork insert path's nested shape
 * *and* the quota row → optional best-effort Nominatim geocoding after
 * commit (throttled, capped, silently lossy).
 */
import { z } from 'zod'
import { and, count, eq, gte } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { NoObjectGeneratedError, generateObject } from 'ai'
import { createGoogle } from '@ai-sdk/google'

import { db as appDb } from '#/db'
import type * as schema from '#/db/schema'
import { aiGeneration, itinerary, itineraryDay, stop } from '#/db/schema'
import { env } from '#/env'
import { getLocale } from '#/paraglide/runtime'
import { getSessionOrThrow } from './context'
import { AI_STYLE_OPTIONS, buildAiItinerarySchema, buildDraftRows, buildGenerationPrompt } from './domain/ai-draft'
import { makeSlug } from './domain/slug'
import { ERR_AI_GENERATION_FAILED, ERR_AI_QUOTA_EXCEEDED, ERR_UNAUTHORIZED } from './errors'
import type { SessionUser } from './itineraries'

type Database = NodePgDatabase<typeof schema>

/** Successful generations allowed per user per UTC day. */
export const AI_DAILY_GENERATION_LIMIT = 5

const GENERATION_TIMEOUT_MS = 60_000
const GENERATION_MODEL = 'gemini-2.5-flash'

/** Start of the current UTC day — the quota window boundary. */
function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Rows the user has spent of today's quota (successful generations only — failures never insert). */
async function countTodayGenerations(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(aiGeneration)
    .where(and(eq(aiGeneration.userId, userId), gte(aiGeneration.createdAt, startOfUtcDay(new Date()))))
  return row.value
}

// ---------------------------------------------------------------------------
// getAiAvailability
// ---------------------------------------------------------------------------

export interface AiAvailability {
  /** Whether the AI mode is usable at all (provider key configured). When false the UI hides the mode entirely. */
  enabled: boolean
  remainingToday: number
}

export async function getAiAvailabilityImpl(
  db: Database,
  session: SessionUser | null,
): Promise<AiAvailability> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const used = await countTodayGenerations(db, session.user.id)
  return {
    enabled: Boolean(env.GEMINI_API_KEY),
    remainingToday: Math.max(0, AI_DAILY_GENERATION_LIMIT - used),
  }
}

export const getAiAvailability = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionOrThrow(getRequest())
  return getAiAvailabilityImpl(appDb, session)
})

// ---------------------------------------------------------------------------
// generateItineraryDraft
// ---------------------------------------------------------------------------

const generateItineraryDraftSchema = z.object({
  destination: z.string().min(1).max(200),
  days: z.number().int().min(1).max(14),
  styles: z.array(z.enum(AI_STYLE_OPTIONS)).max(AI_STYLE_OPTIONS.length),
  preferences: z.string().max(2000).optional(),
  geocode: z.boolean(),
})

/** Client-validated fields plus the server-resolved Paraglide locale. */
export type GenerateItineraryDraftInput = z.infer<typeof generateItineraryDraftSchema> & {
  locale: string
}

/**
 * Generates a draft itinerary with the provider and persists it (days +
 * stops + quota row) in one transaction. Returns the new itinerary's id for
 * the client to open in the editor.
 */
export async function generateItineraryDraftImpl(
  db: Database,
  session: SessionUser | null,
  input: GenerateItineraryDraftInput,
): Promise<{ id: string }> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const userId = session.user.id

  const used = await countTodayGenerations(db, userId)
  if (used >= AI_DAILY_GENERATION_LIMIT) {
    throw new Error(ERR_AI_QUOTA_EXCEEDED)
  }

  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    // The UI hides the AI mode when the key is missing (getAiAvailability),
    // so a direct call landing here is the misconfigured-caller edge case.
    throw new Error(ERR_AI_GENERATION_FAILED)
  }

  const outputSchema = buildAiItinerarySchema(input.days)
  const prompt = buildGenerationPrompt({
    destination: input.destination,
    dayCount: input.days,
    styles: input.styles,
    preferences: input.preferences,
    locale: input.locale,
  })

  const model = createGoogle({ apiKey })(GENERATION_MODEL)
  let draft: z.infer<typeof outputSchema> | null = null
  // One retry, and only for schema-validation failures (the model produced
  // *something*, just not in shape) — provider/network errors fail straight
  // away and the AI SDK's own transport-level retries already covered them.
  for (let attempt = 0; attempt < 2 && !draft; attempt++) {
    try {
      const result = await generateObject({
        model,
        schema: outputSchema,
        prompt,
        abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
      })
      draft = result.object
    } catch (error) {
      const isRetryableShapeFailure = NoObjectGeneratedError.isInstance(error) && attempt === 0
      if (!isRetryableShapeFailure) {
        throw new Error(ERR_AI_GENERATION_FAILED)
      }
    }
  }
  if (!draft) {
    throw new Error(ERR_AI_GENERATION_FAILED)
  }

  const rows = buildDraftRows(draft, {
    ownerId: userId,
    destination: input.destination,
    slug: makeSlug(draft.title),
  })

  const persisted = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(itinerary)
      .values(rows.itinerary)
      .returning({ id: itinerary.id })

    const stopRows: Array<{ id: string; name: string }> = []
    for (const day of rows.days) {
      const [newDay] = await tx
        .insert(itineraryDay)
        .values({
          itineraryId: created.id,
          dayNumber: day.dayNumber,
          title: day.title,
          note: day.note,
        })
        .returning({ id: itineraryDay.id })

      if (day.stops.length > 0) {
        const inserted = await tx
          .insert(stop)
          .values(day.stops.map((s) => ({ ...s, dayId: newDay.id })))
          .returning({ id: stop.id, name: stop.name })
        stopRows.push(...inserted)
      }
    }

    await tx.insert(aiGeneration).values({ userId })

    return { id: created.id, stopRows }
  })

  if (input.geocode) {
    await geocodeStopsBestEffort(db, { stops: persisted.stopRows, destination: input.destination })
  }

  return { id: persisted.id }
}

export const generateItineraryDraft = createServerFn({ method: 'POST' })
  .validator(generateItineraryDraftSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return generateItineraryDraftImpl(appDb, session, { ...data, locale: getLocale() })
  })

// ---------------------------------------------------------------------------
// Best-effort geocoding (opt-in)
// ---------------------------------------------------------------------------

const GEOCODE_STOP_CAP = 15
const GEOCODE_THROTTLE_MS = 1_000
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Server-side, post-commit pin lookup: one Nominatim request per stop
 * (`name, destination`), throttled to the API's 1 req/s policy and capped.
 * Every failure — network, non-OK, malformed body, no match — is silent for
 * that stop; the editor's PlacePicker remains the manual fallback. Distinct
 * from `#/lib/nominatim`, which is the *client-side* editor search with its
 * own single-flight semantics.
 */
async function geocodeStopsBestEffort(
  db: Database,
  { stops, destination }: { stops: Array<{ id: string; name: string }>; destination: string },
): Promise<void> {
  const targets = stops.slice(0, GEOCODE_STOP_CAP)
  for (let i = 0; i < targets.length; i++) {
    if (i > 0) {
      await sleep(GEOCODE_THROTTLE_MS)
    }
    const target = targets[i]
    try {
      const url = new URL(NOMINATIM_SEARCH_URL)
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('q', `${target.name}, ${destination}`)
      url.searchParams.set('limit', '1')

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'roteiros-app' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) {
        continue
      }
      const data: unknown = await response.json()
      if (!Array.isArray(data) || data.length === 0) {
        continue
      }
      const item = data[0] as { display_name?: unknown; lat?: unknown; lon?: unknown }
      if (typeof item.display_name !== 'string') {
        continue
      }
      const lat = typeof item.lat === 'string' ? Number(item.lat) : NaN
      const lng = typeof item.lon === 'string' ? Number(item.lon) : NaN
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue
      }
      await db
        .update(stop)
        .set({ lat, lng, placeLabel: item.display_name })
        .where(eq(stop.id, target.id))
    } catch {
      // Silent per-stop failure by design — pins are a nice-to-have.
    }
  }
}
