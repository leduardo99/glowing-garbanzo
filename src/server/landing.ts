/**
 * Landing-page data: the community's best itineraries (top rated / most
 * viewed shelves) and every geocoded public route for the hero map.
 *
 * Follows the same `*Impl(db, ...)` / thin `createServerFn` wrapper pattern
 * documented in `itineraries.ts`. Everything here is public data
 * (published + public itineraries only), so there is no session handling at
 * all — the landing renders identically for anonymous visitors and
 * signed-in users (who are redirected to `/explore` by the route anyway).
 */
import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createServerFn } from '@tanstack/react-start'

import { db as appDb } from '#/db'
import type * as schema from '#/db/schema'
import { itinerary, itineraryDay, stop } from '#/db/schema'
import type { ItineraryCard } from './itineraries'

type Database = NodePgDatabase<typeof schema>

/** Cards per landing shelf. */
export const HIGHLIGHT_LIMIT = 6
/** Max routes drawn on the hero map — enough to feel alive, capped for payload size. */
const MAP_ROUTE_LIMIT = 12
/** Max points per drawn route (stops beyond this are simply not drawn). */
const MAP_STOPS_PER_ROUTE = 20

export interface LandingMapRoute {
  slug: string
  title: string
  /** Geocoded stops in visit order (day, then position). */
  points: Array<{ lat: number; lng: number }>
}

export interface LandingHighlights {
  topRated: ItineraryCard[]
  mostViewed: ItineraryCard[]
  mapRoutes: LandingMapRoute[]
}

const dayCountExpr = sql<number>`(select count(*)::int from ${itineraryDay} where ${itineraryDay.itineraryId} = ${sql.raw('"itinerary"."id"')})`
const costTotalExpr = sql<number>`(select coalesce(sum(s."cost_cents"), 0)::int from "stop" s join "itinerary_day" d on s."day_id" = d."id" where d."itinerary_id" = "itinerary"."id")`

const cardColumns = {
  id: itinerary.id,
  slug: itinerary.slug,
  title: itinerary.title,
  destination: itinerary.destination,
  summary: itinerary.summary,
  tags: itinerary.tags,
  coverImageUrl: itinerary.coverImageUrl,
  ratingAvg: itinerary.ratingAvg,
  ratingCount: itinerary.ratingCount,
  publishedAt: itinerary.publishedAt,
  dayCount: dayCountExpr,
  costTotalCents: costTotalExpr,
  currency: itinerary.currency,
}

function toCard(row: {
  id: string
  slug: string
  title: string
  destination: string | null
  summary: string | null
  tags: string[] | null
  coverImageUrl: string | null
  ratingAvg: string | null
  ratingCount: number
  publishedAt: Date | null
  dayCount: number
  costTotalCents: number
  currency: string
}): ItineraryCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    destination: row.destination,
    summary: row.summary,
    tags: row.tags ?? [],
    coverImageUrl: row.coverImageUrl,
    ratingAvg: row.ratingAvg === null ? null : parseFloat(row.ratingAvg),
    ratingCount: row.ratingCount,
    dayCount: row.dayCount,
    costTotalCents: row.costTotalCents,
    currency: row.currency,
    publishedAt: row.publishedAt,
  }
}

const publicOnly = and(
  eq(itinerary.status, 'published'),
  eq(itinerary.visibility, 'public'),
)!

/**
 * The landing page's three data blocks in one call:
 * - `topRated`: rating-sorted shelf (rated itineraries only — an unrated
 *   itinerary can't be "top rated").
 * - `mostViewed`: view-count-sorted shelf (viewed at least once).
 * - `mapRoutes`: geocoded stops (visit order) of the most recently
 *   published itineraries that have ≥2 pins — enough to draw a route line.
 */
export async function getLandingHighlightsImpl(
  db: Database,
): Promise<LandingHighlights> {
  const [topRatedRows, mostViewedRows] = await Promise.all([
    db
      .select(cardColumns)
      .from(itinerary)
      .where(and(publicOnly, sql`${itinerary.ratingCount} > 0`))
      .orderBy(
        sql`${itinerary.ratingAvg} DESC NULLS LAST`,
        desc(itinerary.ratingCount),
        desc(itinerary.id),
      )
      .limit(HIGHLIGHT_LIMIT),
    db
      .select(cardColumns)
      .from(itinerary)
      .where(and(publicOnly, sql`${itinerary.viewCount} > 0`))
      .orderBy(desc(itinerary.viewCount), desc(itinerary.id))
      .limit(HIGHLIGHT_LIMIT),
  ])

  // Hero map routes: newest published itineraries that have geocoded stops.
  const candidates = await db
    .select({ id: itinerary.id, slug: itinerary.slug, title: itinerary.title })
    .from(itinerary)
    .where(publicOnly)
    .orderBy(desc(itinerary.publishedAt), desc(itinerary.id))
    .limit(MAP_ROUTE_LIMIT * 3)

  const mapRoutes: LandingMapRoute[] = []
  if (candidates.length > 0) {
    const days = await db
      .select({
        id: itineraryDay.id,
        itineraryId: itineraryDay.itineraryId,
        dayNumber: itineraryDay.dayNumber,
      })
      .from(itineraryDay)
      .where(
        inArray(
          itineraryDay.itineraryId,
          candidates.map((c) => c.id),
        ),
      )
      .orderBy(asc(itineraryDay.dayNumber))
    const dayIds = days.map((d) => d.id)
    const stops = dayIds.length
      ? await db
          .select({
            dayId: stop.dayId,
            position: stop.position,
            lat: stop.lat,
            lng: stop.lng,
          })
          .from(stop)
          .where(and(inArray(stop.dayId, dayIds), isNotNull(stop.lat), isNotNull(stop.lng)))
          .orderBy(asc(stop.position))
      : []

    const dayById = new Map(days.map((d) => [d.id, d]))
    const pointsByItinerary = new Map<string, Array<{ day: number; position: number; lat: number; lng: number }>>()
    for (const s of stops) {
      const day = dayById.get(s.dayId)
      if (!day || s.lat === null || s.lng === null) continue
      const list = pointsByItinerary.get(day.itineraryId) ?? []
      list.push({ day: day.dayNumber, position: s.position, lat: s.lat, lng: s.lng })
      pointsByItinerary.set(day.itineraryId, list)
    }

    for (const candidate of candidates) {
      const points = (pointsByItinerary.get(candidate.id) ?? [])
        .sort((a, b) => a.day - b.day || a.position - b.position)
        .slice(0, MAP_STOPS_PER_ROUTE)
        .map(({ lat, lng }) => ({ lat, lng }))
      if (points.length >= 2) {
        mapRoutes.push({ slug: candidate.slug, title: candidate.title, points })
      }
      if (mapRoutes.length >= MAP_ROUTE_LIMIT) break
    }
  }

  return {
    topRated: topRatedRows.map(toCard),
    mostViewed: mostViewedRows.map(toCard),
    mapRoutes,
  }
}

export const getLandingHighlights = createServerFn({ method: 'GET' }).handler(
  async () => getLandingHighlightsImpl(appDb),
)
