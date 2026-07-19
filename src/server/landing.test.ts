import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { itinerary, itineraryDay, stop } from '#/db/schema'
import {
  closeTestDb,
  createTestUser,
  resetTestDb,
  setupTestDb,
  testDb,
} from '#/test/db'
import {
  createItineraryImpl,
  getItineraryBySlugImpl,
  publishItineraryImpl,
  updateItineraryImpl,
} from './itineraries'
import { getLandingHighlightsImpl } from './landing'

describe('landing highlights & view counting', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  beforeEach(async () => {
    await resetTestDb()
  })

  afterAll(async () => {
    await resetTestDb()
    await closeTestDb()
  })

  async function publishedItinerary(
    authorId: string,
    title: string,
    overrides: Partial<typeof itinerary.$inferInsert> = {},
  ) {
    const created = await createItineraryImpl(
      testDb,
      { user: { id: authorId } },
      { title, destination: 'Brasil' },
    )
    await publishItineraryImpl(testDb, { user: { id: authorId } }, { id: created.id })
    if (Object.keys(overrides).length > 0) {
      await testDb.update(itinerary).set(overrides).where(eq(itinerary.id, created.id))
    }
    return created
  }

  describe('view counting (getItineraryBySlugImpl)', () => {
    it('increments for anonymous and non-author views of a public published itinerary', async () => {
      const author = await createTestUser()
      const visitor = await createTestUser()
      const created = await publishedItinerary(author.id, 'Praia e sol')

      await getItineraryBySlugImpl(testDb, null, { slug: created.slug })
      await getItineraryBySlugImpl(testDb, { user: { id: visitor.id } }, { slug: created.slug })

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row!.viewCount).toBe(2)
    })

    it("does not count the author's own views", async () => {
      const author = await createTestUser()
      const created = await publishedItinerary(author.id, 'Minha viagem')

      await getItineraryBySlugImpl(testDb, { user: { id: author.id } }, { slug: created.slug })

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row!.viewCount).toBe(0)
    })

    it('does not count views of drafts', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(
        testDb,
        { user: { id: author.id } },
        { title: 'Rascunho', destination: 'Bahia' },
      )

      // Draft is only readable by its author, whose views don't count.
      await getItineraryBySlugImpl(testDb, { user: { id: author.id } }, { slug: created.slug })

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row!.viewCount).toBe(0)
    })

    it('does not bump updatedAt when counting a view', async () => {
      const author = await createTestUser()
      const created = await publishedItinerary(author.id, 'Sem churn')
      const before = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })

      await getItineraryBySlugImpl(testDb, null, { slug: created.slug })

      const after = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(after!.updatedAt.getTime()).toBe(before!.updatedAt.getTime())
      expect(after!.viewCount).toBe(1)
    })
  })

  describe('getLandingHighlightsImpl', () => {
    it('returns rating-sorted and view-sorted shelves, public-only', async () => {
      const author = await createTestUser()
      const a = await publishedItinerary(author.id, 'Bem avaliado', {
        ratingAvg: '4.8',
        ratingCount: 12,
        viewCount: 3,
      })
      const b = await publishedItinerary(author.id, 'Muito visto', {
        ratingAvg: '4.1',
        ratingCount: 2,
        viewCount: 50,
      })
      // Private + published: must appear on neither shelf.
      const hidden = await publishedItinerary(author.id, 'Escondido', {
        ratingAvg: '5.0',
        ratingCount: 99,
        viewCount: 999,
      })
      await updateItineraryImpl(
        testDb,
        { user: { id: author.id } },
        { id: hidden.id, visibility: 'private' },
      )
      // Unrated + unviewed: appears on neither shelf.
      await publishedItinerary(author.id, 'Novato')

      const highlights = await getLandingHighlightsImpl(testDb)
      expect(highlights.topRated.map((i) => i.id)).toEqual([a.id, b.id])
      expect(highlights.mostViewed.map((i) => i.id)).toEqual([b.id, a.id])
    })

    it('returns geocoded routes in visit order, skipping itineraries with <2 pins', async () => {
      const author = await createTestUser()
      const mapped = await publishedItinerary(author.id, 'Com mapa')
      const dayRows = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, mapped.id),
      })
      const [d2] = await testDb
        .insert(itineraryDay)
        .values({ itineraryId: mapped.id, dayNumber: 2 })
        .returning({ id: itineraryDay.id })
      await testDb.insert(stop).values([
        { dayId: d2.id, position: 1, name: 'C', category: 'attraction', lat: -3, lng: -40 },
        { dayId: dayRows[0].id, position: 2, name: 'B', category: 'food', lat: -2, lng: -39 },
        { dayId: dayRows[0].id, position: 1, name: 'A', category: 'attraction', lat: -1, lng: -38 },
        // No coords — never part of a route.
        { dayId: dayRows[0].id, position: 3, name: 'X', category: 'other' },
      ])
      // One geocoded pin only — not enough for a line, must be skipped.
      const single = await publishedItinerary(author.id, 'Um pino só')
      const singleDays = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, single.id),
      })
      await testDb.insert(stop).values([
        { dayId: singleDays[0].id, position: 1, name: 'S', category: 'other', lat: -5, lng: -35 },
      ])

      const highlights = await getLandingHighlightsImpl(testDb)
      expect(highlights.mapRoutes).toHaveLength(1)
      expect(highlights.mapRoutes[0].slug).toBe(mapped.slug)
      expect(highlights.mapRoutes[0].points).toEqual([
        { lat: -1, lng: -38 },
        { lat: -2, lng: -39 },
        { lat: -3, lng: -40 },
      ])
    })
  })
})
