/**
 * Community-wide stats for the marketing surfaces: the landing's quiet
 * social-proof line + destination chips, and the auth panel's numbers.
 * Public data only (published + public itineraries), no session — same
 * `*Impl(db)` / thin wrapper pattern as landing.ts.
 */
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createServerFn } from '@tanstack/react-start'

import { db as appDb } from '#/db'
import type * as schema from '#/db/schema'
import { itinerary } from '#/db/schema'

type Database = NodePgDatabase<typeof schema>

/** Chips shown under the landing hero — enough to invite, not a directory. */
export const TOP_DESTINATION_LIMIT = 6

export interface CommunityStats {
  /** Published + public itineraries. */
  itineraryCount: number
  /** Distinct non-empty destinations among them. */
  destinationCount: number
  /** Most-published destinations, for the landing's explore chips. */
  topDestinations: Array<{ destination: string; count: number }>
}

const publicPublished = and(
  eq(itinerary.status, 'published'),
  eq(itinerary.visibility, 'public'),
)

export async function getCommunityStatsImpl(
  db: Database,
): Promise<CommunityStats> {
  const [totals, destinations] = await Promise.all([
    db
      .select({
        itineraryCount: sql<number>`count(*)::int`,
        destinationCount: sql<number>`count(distinct ${itinerary.destination})::int`,
      })
      .from(itinerary)
      .where(publicPublished),
    db
      .select({
        destination: itinerary.destination,
        count: sql<number>`count(*)::int`,
      })
      .from(itinerary)
      .where(and(publicPublished, isNotNull(itinerary.destination)))
      .groupBy(itinerary.destination)
      .orderBy(desc(sql`count(*)`), itinerary.destination)
      .limit(TOP_DESTINATION_LIMIT),
  ])

  return {
    itineraryCount: totals[0].itineraryCount,
    destinationCount: totals[0].destinationCount,
    topDestinations: destinations.filter(
      (d): d is { destination: string; count: number } => d.destination !== null,
    ),
  }
}

export const getCommunityStats = createServerFn({ method: 'GET' }).handler(
  () => getCommunityStatsImpl(appDb),
)
