// scripts/smoke-seed.ts
import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { and, eq } from 'drizzle-orm'

import { db } from '../src/db/index.ts'
import { comment, itinerary, itineraryDay, stop } from '../src/db/schema.ts'

/**
 * Idempotent fixtures for the smoke harness (scripts/smoke.ts): one
 * published public itinerary owned by the smoke test user, with a day,
 * two geolocated stops (so the map/route surfaces render) and one
 * comment (so the SSR'd relative-time path renders). Runs under tsx,
 * outside Vite — must not import anything that pulls in src/env.ts.
 */
const SMOKE_TITLE = 'Smoke E2E Trip'
const SMOKE_COMMENT = 'Smoke harness comment — do not delete.'

export async function ensureSmokeData(
  authorId: string,
): Promise<{ itineraryId: string; slug: string }> {
  const existing = await db.query.itinerary.findFirst({
    where: and(eq(itinerary.authorId, authorId), eq(itinerary.title, SMOKE_TITLE)),
  })
  const record =
    existing ??
    (
      await db
        .insert(itinerary)
        .values({
          authorId,
          title: SMOKE_TITLE,
          slug: `smoke-e2e-trip-${authorId.slice(0, 8)}`,
          destination: 'Lisboa',
          status: 'published',
          publishedAt: new Date(),
        })
        .returning({ id: itinerary.id, slug: itinerary.slug })
    )[0]

  if (!existing) {
    const [day] = await db
      .insert(itineraryDay)
      .values({ itineraryId: record.id, dayNumber: 1, title: 'Day 1' })
      .returning({ id: itineraryDay.id })
    await db.insert(stop).values([
      {
        dayId: day.id,
        position: 1,
        name: 'Torre de Belém',
        category: 'attraction',
        lat: 38.6916,
        lng: -9.216,
      },
      {
        dayId: day.id,
        position: 2,
        name: 'Time Out Market',
        category: 'food',
        lat: 38.7071,
        lng: -9.1458,
      },
    ])
  }

  const existingComment = await db.query.comment.findFirst({
    where: and(eq(comment.itineraryId, record.id), eq(comment.body, SMOKE_COMMENT)),
  })
  if (!existingComment) {
    await db
      .insert(comment)
      .values({ itineraryId: record.id, authorId, body: SMOKE_COMMENT })
  }

  return { itineraryId: record.id, slug: record.slug }
}

// Direct invocation doubles as the DB preflight the harness needs.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const rows = await db.$count(itinerary)
  console.log(`db ok — ${rows} itineraries`)
  process.exit(0)
}
