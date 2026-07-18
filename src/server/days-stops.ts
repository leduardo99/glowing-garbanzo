/**
 * Day and stop CRUD, reordering, and cross-day moves.
 *
 * Follows the same `*Impl(db, session, input)` / thin `createServerFn`
 * wrapper pattern documented at the top of `itineraries.ts`, including the
 * three-sentinel error convention (see `./errors`).
 * Every mutation here is gated on "caller is the parent itinerary's author",
 * resolved by walking the FK chain up from the day/stop being touched:
 *   stop -> itinerary_day -> itinerary
 * NOT_FOUND is thrown for a missing day/stop/itinerary; FORBIDDEN is thrown
 * once the row is found but the caller isn't its author — matching the
 * mutation-path convention from Task 4.
 */
import { z } from 'zod'
import { asc, eq, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { db as appDb } from '#/db'
import type * as schema from '#/db/schema'
import { itineraryDay, stop } from '#/db/schema'
import { getSessionOrThrow } from './context'
import type { SessionUser } from './itineraries'
import { ERR_FORBIDDEN, ERR_NOT_FOUND, ERR_UNAUTHORIZED } from './errors'
import { requireItineraryAuthor } from './shared'

type Database = NodePgDatabase<typeof schema>

const stopCategorySchema = z.enum(['attraction', 'food', 'lodging', 'transport', 'other'])

// ---------------------------------------------------------------------------
// Shared FK-chain ownership helpers
// ---------------------------------------------------------------------------

async function loadDayOrThrow(db: Database, id: string) {
  const row = await db.query.itineraryDay.findFirst({ where: eq(itineraryDay.id, id) })
  if (!row) {
    throw new Error(ERR_NOT_FOUND)
  }
  return row
}

async function loadStopOrThrow(db: Database, id: string) {
  const row = await db.query.stop.findFirst({ where: eq(stop.id, id) })
  if (!row) {
    throw new Error(ERR_NOT_FOUND)
  }
  return row
}

/** Resolves a day and asserts the caller is the parent itinerary's author. */
async function requireDayAuthor(db: Database, session: SessionUser | null, dayId: string) {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const day = await loadDayOrThrow(db, dayId)
  const itineraryRow = await requireItineraryAuthor(db, session, day.itineraryId)
  return { day, itinerary: itineraryRow }
}

/** Resolves a stop (and its day) and asserts the caller is the parent itinerary's author. */
async function requireStopAuthor(db: Database, session: SessionUser | null, stopId: string) {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const stopRow = await loadStopOrThrow(db, stopId)
  const day = await loadDayOrThrow(db, stopRow.dayId)
  const itineraryRow = await requireItineraryAuthor(db, session, day.itineraryId)
  return { stop: stopRow, day, itinerary: itineraryRow }
}

// ---------------------------------------------------------------------------
// addDay
// ---------------------------------------------------------------------------

const addDaySchema = z.object({
  itineraryId: z.string().min(1),
  title: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

export type AddDayInput = z.infer<typeof addDaySchema>

/** Appends a new day at the next `dayNumber` for the itinerary. Author only. */
export async function addDayImpl(
  db: Database,
  session: SessionUser | null,
  input: AddDayInput,
): Promise<{ id: string; dayNumber: number }> {
  const itineraryRow = await requireItineraryAuthor(db, session, input.itineraryId)

  return db.transaction(async (tx) => {
    const [{ maxDayNumber }] = await tx
      .select({ maxDayNumber: sql<number | null>`max(${itineraryDay.dayNumber})` })
      .from(itineraryDay)
      .where(eq(itineraryDay.itineraryId, itineraryRow.id))
    const nextDayNumber = (maxDayNumber ?? 0) + 1

    const [created] = await tx
      .insert(itineraryDay)
      .values({
        itineraryId: itineraryRow.id,
        dayNumber: nextDayNumber,
        title: input.title,
        note: input.note,
      })
      .returning({ id: itineraryDay.id, dayNumber: itineraryDay.dayNumber })

    return created
  })
}

export const addDay = createServerFn({ method: 'POST' })
  .validator(addDaySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return addDayImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// removeDay
// ---------------------------------------------------------------------------

const removeDaySchema = z.object({ id: z.string().min(1) })

export type RemoveDayInput = z.infer<typeof removeDaySchema>

/**
 * Deletes a day (stops cascade via FK) and renumbers subsequent days so
 * `dayNumber` stays a contiguous 1..n sequence. Renumbers in ascending
 * order so each update lands on the slot the previous update just freed,
 * never colliding with the unique `(itineraryId, dayNumber)` constraint.
 */
export async function removeDayImpl(
  db: Database,
  session: SessionUser | null,
  input: RemoveDayInput,
): Promise<void> {
  const { day } = await requireDayAuthor(db, session, input.id)

  await db.transaction(async (tx) => {
    await tx.delete(itineraryDay).where(eq(itineraryDay.id, day.id))

    const subsequent = await tx.query.itineraryDay.findMany({
      where: eq(itineraryDay.itineraryId, day.itineraryId),
      orderBy: asc(itineraryDay.dayNumber),
    })

    for (const d of subsequent) {
      if (d.dayNumber > day.dayNumber) {
        await tx
          .update(itineraryDay)
          .set({ dayNumber: d.dayNumber - 1 })
          .where(eq(itineraryDay.id, d.id))
      }
    }
  })
}

export const removeDay = createServerFn({ method: 'POST' })
  .validator(removeDaySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return removeDayImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// updateDay
// ---------------------------------------------------------------------------

const updateDaySchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

export type UpdateDayInput = z.infer<typeof updateDaySchema>

/** Updates a day's title/note. Author only; `dayNumber` isn't editable here. */
export async function updateDayImpl(
  db: Database,
  session: SessionUser | null,
  input: UpdateDayInput,
): Promise<void> {
  const { day } = await requireDayAuthor(db, session, input.id)

  const updates: Partial<typeof itineraryDay.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.note !== undefined) updates.note = input.note

  if (Object.keys(updates).length === 0) {
    return
  }

  await db.update(itineraryDay).set(updates).where(eq(itineraryDay.id, day.id))
}

export const updateDay = createServerFn({ method: 'POST' })
  .validator(updateDaySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return updateDayImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// addStop
// ---------------------------------------------------------------------------

const addStopSchema = z.object({
  dayId: z.string().min(1),
  name: z.string().min(1),
  category: stopCategorySchema,
  description: z.string().nullable().optional(),
  costCents: z.number().int().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  placeLabel: z.string().nullable().optional(),
})

export type AddStopInput = z.infer<typeof addStopSchema>

/**
 * Appends a stop at the end of the day's stop list. Uses `max(position) + 1`
 * (not a row count) so the new stop always lands after every existing one,
 * even if earlier removals left gaps in the position sequence.
 */
export async function addStopImpl(
  db: Database,
  session: SessionUser | null,
  rawInput: AddStopInput,
): Promise<{ id: string; position: number }> {
  // Re-validated here (not just in the `createServerFn` wrapper's
  // `.validator`) because integration tests call `*Impl` directly against
  // `testDb`, bypassing the wrapper entirely — see the file-level doc
  // comment and `itineraries.ts`'s "Testability pattern" note. Without this,
  // bounds like lat/lng's range would only ever be enforced on the HTTP
  // path, never on the path our tests exercise.
  const input = addStopSchema.parse(rawInput)
  const { day } = await requireDayAuthor(db, session, input.dayId)

  return db.transaction(async (tx) => {
    const [{ maxPosition }] = await tx
      .select({ maxPosition: sql<number | null>`max(${stop.position})` })
      .from(stop)
      .where(eq(stop.dayId, day.id))
    const nextPosition = (maxPosition ?? -1) + 1

    const [created] = await tx
      .insert(stop)
      .values({
        dayId: day.id,
        position: nextPosition,
        name: input.name,
        category: input.category,
        description: input.description,
        costCents: input.costCents,
        lat: input.lat,
        lng: input.lng,
        placeLabel: input.placeLabel,
      })
      .returning({ id: stop.id, position: stop.position })

    return created
  })
}

export const addStop = createServerFn({ method: 'POST' })
  .validator(addStopSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return addStopImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// updateStop
// ---------------------------------------------------------------------------

const updateStopSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  category: stopCategorySchema.optional(),
  description: z.string().nullable().optional(),
  costCents: z.number().int().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  placeLabel: z.string().nullable().optional(),
})

export type UpdateStopInput = z.infer<typeof updateStopSchema>

/** Updates a stop's fields. Author only; `position`/`dayId` aren't editable here. */
export async function updateStopImpl(
  db: Database,
  session: SessionUser | null,
  rawInput: UpdateStopInput,
): Promise<void> {
  // See the matching comment in `addStopImpl` — re-validated here so the
  // lat/lng bounds are enforced on the direct-`Impl`-call path integration
  // tests use, not only on the HTTP path via the wrapper's `.validator`.
  const input = updateStopSchema.parse(rawInput)
  const { stop: stopRow } = await requireStopAuthor(db, session, input.id)

  const updates: Partial<typeof stop.$inferInsert> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.category !== undefined) updates.category = input.category
  if (input.description !== undefined) updates.description = input.description
  if (input.costCents !== undefined) updates.costCents = input.costCents
  if (input.lat !== undefined) updates.lat = input.lat
  if (input.lng !== undefined) updates.lng = input.lng
  if (input.placeLabel !== undefined) updates.placeLabel = input.placeLabel

  if (Object.keys(updates).length === 0) {
    return
  }

  await db.update(stop).set(updates).where(eq(stop.id, stopRow.id))
}

export const updateStop = createServerFn({ method: 'POST' })
  .validator(updateStopSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return updateStopImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// removeStop
// ---------------------------------------------------------------------------

const removeStopSchema = z.object({ id: z.string().min(1) })

export type RemoveStopInput = z.infer<typeof removeStopSchema>

/** Deletes a stop. Author only. Leaves remaining positions as-is (order is preserved, gaps are harmless). */
export async function removeStopImpl(
  db: Database,
  session: SessionUser | null,
  input: RemoveStopInput,
): Promise<void> {
  const { stop: stopRow } = await requireStopAuthor(db, session, input.id)
  await db.delete(stop).where(eq(stop.id, stopRow.id))
}

export const removeStop = createServerFn({ method: 'POST' })
  .validator(removeStopSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return removeStopImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// reorderStops
// ---------------------------------------------------------------------------

const reorderStopsSchema = z.object({
  dayId: z.string().min(1),
  stopIds: z.array(z.string().min(1)),
})

export type ReorderStopsInput = z.infer<typeof reorderStopsSchema>

/**
 * Rewrites every stop's `position` to its index in `stopIds` (0..n-1).
 * `stopIds` must be exactly the set of stop ids currently in the day — no
 * duplicates, nothing missing, nothing foreign (e.g. from another day) —
 * or the whole call is rejected with NOT_FOUND before any write happens.
 */
export async function reorderStopsImpl(
  db: Database,
  session: SessionUser | null,
  input: ReorderStopsInput,
): Promise<void> {
  const { day } = await requireDayAuthor(db, session, input.dayId)

  await db.transaction(async (tx) => {
    const currentStops = await tx.query.stop.findMany({ where: eq(stop.dayId, day.id) })
    const currentIds = new Set(currentStops.map((s) => s.id))
    const inputIdSet = new Set(input.stopIds)

    const isExactMatch =
      inputIdSet.size === input.stopIds.length &&
      inputIdSet.size === currentIds.size &&
      [...inputIdSet].every((id) => currentIds.has(id))

    if (!isExactMatch) {
      throw new Error(ERR_NOT_FOUND)
    }

    for (let i = 0; i < input.stopIds.length; i++) {
      await tx.update(stop).set({ position: i }).where(eq(stop.id, input.stopIds[i]))
    }
  })
}

export const reorderStops = createServerFn({ method: 'POST' })
  .validator(reorderStopsSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return reorderStopsImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// moveStopToDay
// ---------------------------------------------------------------------------

const moveStopToDaySchema = z.object({
  stopId: z.string().min(1),
  targetDayId: z.string().min(1),
  position: z.number().int().min(0),
})

export type MoveStopToDayInput = z.infer<typeof moveStopToDaySchema>

/**
 * Moves a stop to (possibly) another day within the SAME itinerary, at a
 * clamped `position`. Renumbers both the source day's remaining stops and
 * the target day's stops (including the moved one) to a contiguous 0..n-1
 * sequence. Rejects a target day belonging to a different itinerary with
 * FORBIDDEN — the day exists, it's just not a valid target for this caller.
 */
export async function moveStopToDayImpl(
  db: Database,
  session: SessionUser | null,
  input: MoveStopToDayInput,
): Promise<void> {
  const { stop: stopRow, itinerary: itineraryRow } = await requireStopAuthor(db, session, input.stopId)
  const targetDay = await loadDayOrThrow(db, input.targetDayId)

  if (targetDay.itineraryId !== itineraryRow.id) {
    throw new Error(ERR_FORBIDDEN)
  }

  await db.transaction(async (tx) => {
    const sameDay = stopRow.dayId === targetDay.id

    if (sameDay) {
      const siblings = await tx.query.stop.findMany({
        where: eq(stop.dayId, targetDay.id),
        orderBy: asc(stop.position),
      })
      const others = siblings.filter((s) => s.id !== stopRow.id)
      const clamped = Math.max(0, Math.min(input.position, others.length))
      others.splice(clamped, 0, stopRow)

      for (let i = 0; i < others.length; i++) {
        await tx.update(stop).set({ position: i }).where(eq(stop.id, others[i].id))
      }
      return
    }

    const sourceSiblings = await tx.query.stop.findMany({
      where: eq(stop.dayId, stopRow.dayId),
      orderBy: asc(stop.position),
    })
    const remainingSource = sourceSiblings.filter((s) => s.id !== stopRow.id)
    for (let i = 0; i < remainingSource.length; i++) {
      await tx.update(stop).set({ position: i }).where(eq(stop.id, remainingSource[i].id))
    }

    const targetSiblings = await tx.query.stop.findMany({
      where: eq(stop.dayId, targetDay.id),
      orderBy: asc(stop.position),
    })
    const clamped = Math.max(0, Math.min(input.position, targetSiblings.length))
    targetSiblings.splice(clamped, 0, stopRow)

    for (let i = 0; i < targetSiblings.length; i++) {
      const s = targetSiblings[i]
      if (s.id === stopRow.id) {
        await tx.update(stop).set({ position: i, dayId: targetDay.id }).where(eq(stop.id, s.id))
      } else {
        await tx.update(stop).set({ position: i }).where(eq(stop.id, s.id))
      }
    }
  })
}

export const moveStopToDay = createServerFn({ method: 'POST' })
  .validator(moveStopToDaySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return moveStopToDayImpl(appDb, session, data)
  })
