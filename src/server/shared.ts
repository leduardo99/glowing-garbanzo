/**
 * Data helpers shared across the server modules (itineraries, days/stops,
 * engagement) that all follow the `*Impl(db, session, input)` pattern and
 * the sentinel error convention documented in `./errors`.
 */
import { and, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '#/db/schema'
import { itinerary, itineraryMember } from '#/db/schema'
import { ERR_FORBIDDEN, ERR_NOT_FOUND, ERR_UNAUTHORIZED } from './errors'
import type { SessionUser } from './itineraries'

type Database = NodePgDatabase<typeof schema>

/** Loads an itinerary row or throws NOT_FOUND. */
export async function loadItineraryOrThrow(db: Database, id: string) {
  const row = await db.query.itinerary.findFirst({ where: eq(itinerary.id, id) })
  if (!row) {
    throw new Error(ERR_NOT_FOUND)
  }
  return row
}

/** Whether `userId` is a member (collaborator) of `itineraryId`. */
export async function isItineraryMember(db: Database, itineraryId: string, userId: string): Promise<boolean> {
  const membership = await db.query.itineraryMember.findFirst({
    where: and(eq(itineraryMember.itineraryId, itineraryId), eq(itineraryMember.userId, userId)),
  })
  return Boolean(membership)
}

/** Loads an itinerary row and asserts the session user is its author. */
export async function requireItineraryAuthor(db: Database, session: SessionUser | null, itineraryId: string) {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const row = await loadItineraryOrThrow(db, itineraryId)
  if (row.authorId !== session.user.id) {
    throw new Error(ERR_FORBIDDEN)
  }
  return row
}
