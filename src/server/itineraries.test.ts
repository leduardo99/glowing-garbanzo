import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { itinerary, itineraryDay, rating, stop } from '#/db/schema'
import { closeTestDb, createTestUser, resetTestDb, setupTestDb, testDb } from '#/test/db'
import {
  createItineraryImpl,
  deleteItineraryImpl,
  forkItineraryImpl,
  getItineraryBySlugImpl,
  publishItineraryImpl,
  searchItinerariesImpl,
  unpublishItineraryImpl,
  updateItineraryImpl,
} from './itineraries'

describe('itineraries server functions', () => {
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

  describe('createItineraryImpl', () => {
    it('rejects an anonymous caller', async () => {
      await expect(
        createItineraryImpl(testDb, null, { title: 'Weekend in Lisbon', destination: 'Lisbon' }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('creates a draft with one empty day', async () => {
      const author = await createTestUser()

      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      expect(created.id).toBeDefined()
      expect(created.slug).toContain('weekend-in-lisbon')

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.status).toBe('draft')
      expect(row?.authorId).toBe(author.id)

      const days = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, created.id),
      })
      expect(days).toHaveLength(1)
      expect(days[0]?.dayNumber).toBe(1)
    })
  })

  describe('getItineraryBySlugImpl', () => {
    it('is readable by the author while a draft, invisible to others (not found)', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Chapada Diamantina',
        destination: 'Bahia',
      })

      const asAuthor = await getItineraryBySlugImpl(testDb, { user: { id: author.id } }, {
        slug: created.slug,
      })
      expect(asAuthor.title).toBe('Chapada Diamantina')
      expect(asAuthor.viewer.canEdit).toBe(true)

      await expect(
        getItineraryBySlugImpl(testDb, { user: { id: other.id } }, { slug: created.slug }),
      ).rejects.toThrow('NOT_FOUND')

      await expect(
        getItineraryBySlugImpl(testDb, null, { slug: created.slug }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('throws not found for an unknown slug', async () => {
      await expect(
        getItineraryBySlugImpl(testDb, null, { slug: 'does-not-exist' }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('becomes readable by anyone once published, with days and stops nested', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Chapada Diamantina',
        destination: 'Bahia',
      })

      const [day] = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, created.id),
      })
      await testDb.insert(stop).values({
        dayId: day.id,
        position: 1,
        name: 'Poço Azul',
        category: 'attraction',
      })

      await publishItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })

      const asStranger = await getItineraryBySlugImpl(testDb, { user: { id: stranger.id } }, {
        slug: created.slug,
      })
      expect(asStranger.viewer.canEdit).toBe(false)
      expect(asStranger.viewer.isFavorite).toBe(false)
      expect(asStranger.viewer.myStars).toBeNull()
      expect(asStranger.viewer.isMember).toBe(false)
      expect(asStranger.days).toHaveLength(1)
      expect(asStranger.days[0]?.stops).toHaveLength(1)
      expect(asStranger.days[0]?.stops[0]?.name).toBe('Poço Azul')

      const anonymous = await getItineraryBySlugImpl(testDb, null, { slug: created.slug })
      expect(anonymous.viewer.isMember).toBe(false)
      expect(anonymous.viewer.myStars).toBeNull()
    })

    it('grants read access to a private itinerary via a matching invite token', async () => {
      const author = await createTestUser()
      const invitee = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Private trip',
        destination: 'Somewhere',
      })
      await updateItineraryImpl(testDb, { user: { id: author.id } }, {
        id: created.id,
        visibility: 'private',
      })
      await publishItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })
      await testDb.update(itinerary).set({ inviteToken: 'secret-token' }).where(eq(itinerary.id, created.id))

      await expect(
        getItineraryBySlugImpl(testDb, { user: { id: invitee.id } }, { slug: created.slug }),
      ).rejects.toThrow('NOT_FOUND')

      const withToken = await getItineraryBySlugImpl(testDb, { user: { id: invitee.id } }, {
        slug: created.slug,
        inviteToken: 'secret-token',
      })
      expect(withToken.id).toBe(created.id)

      await expect(
        getItineraryBySlugImpl(testDb, { user: { id: invitee.id } }, {
          slug: created.slug,
          inviteToken: 'wrong-token',
        }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('does not grant read access to a private draft via a matching invite token', async () => {
      const author = await createTestUser()
      const invitee = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Private draft trip',
        destination: 'Somewhere',
      })
      await updateItineraryImpl(testDb, { user: { id: author.id } }, {
        id: created.id,
        visibility: 'private',
      })
      await testDb.update(itinerary).set({ inviteToken: 'secret-token' }).where(eq(itinerary.id, created.id))

      await expect(
        getItineraryBySlugImpl(testDb, { user: { id: invitee.id } }, {
          slug: created.slug,
          inviteToken: 'secret-token',
        }),
      ).rejects.toThrow('NOT_FOUND')
    })
  })

  describe('updateItineraryImpl', () => {
    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Original title',
        destination: 'Lisbon',
      })

      await expect(
        updateItineraryImpl(testDb, { user: { id: other.id } }, {
          id: created.id,
          title: 'Hijacked',
        }),
      ).rejects.toThrow('FORBIDDEN')

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.title).toBe('Original title')
    })

    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Original title',
        destination: 'Lisbon',
      })

      await expect(
        updateItineraryImpl(testDb, null, { id: created.id, title: 'Hijacked' }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('throws not found for an unknown id', async () => {
      const author = await createTestUser()
      await expect(
        updateItineraryImpl(testDb, { user: { id: author.id } }, {
          id: 'does-not-exist',
          title: 'x',
        }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('lets the author update metadata fields', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Original title',
        destination: 'Lisbon',
      })

      await updateItineraryImpl(testDb, { user: { id: author.id } }, {
        id: created.id,
        title: 'New title',
        summary: 'A lovely trip',
        tags: ['food', 'budget'],
        visibility: 'private',
        coverImageUrl: '/uploads/cover.jpg',
      })

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.title).toBe('New title')
      expect(row?.summary).toBe('A lovely trip')
      expect(row?.tags).toEqual(['food', 'budget'])
      expect(row?.visibility).toBe('private')
      expect(row?.coverImageUrl).toBe('/uploads/cover.jpg')
      // slug is immutable
      expect(row?.slug).toBe(created.slug)
    })
  })

  describe('deleteItineraryImpl', () => {
    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'To keep',
        destination: 'Lisbon',
      })

      await expect(
        deleteItineraryImpl(testDb, { user: { id: other.id } }, { id: created.id }),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('cascades to days and stops', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'To delete',
        destination: 'Lisbon',
      })
      const [day] = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, created.id),
      })
      await testDb.insert(stop).values({
        dayId: day.id,
        position: 1,
        name: 'Some stop',
        category: 'food',
      })

      await deleteItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })

      const remainingItinerary = await testDb.query.itinerary.findFirst({
        where: eq(itinerary.id, created.id),
      })
      expect(remainingItinerary).toBeUndefined()

      const remainingDays = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, created.id),
      })
      expect(remainingDays).toHaveLength(0)

      const remainingStops = await testDb.query.stop.findMany({ where: eq(stop.dayId, day.id) })
      expect(remainingStops).toHaveLength(0)
    })
  })

  describe('publishItineraryImpl / unpublishItineraryImpl', () => {
    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })

      await expect(
        publishItineraryImpl(testDb, { user: { id: other.id } }, { id: created.id }),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('publishing sets status/publishedAt, unpublishing reverts to draft', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })

      await publishItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })
      let row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.status).toBe('published')
      expect(row?.publishedAt).not.toBeNull()

      await unpublishItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })
      row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.status).toBe('draft')
    })
  })

  describe('forkItineraryImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      await publishItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })

      await expect(forkItineraryImpl(testDb, null, { id: created.id })).rejects.toThrow(
        'UNAUTHORIZED',
      )
    })

    it('rejects forking an itinerary with no read access', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })

      await expect(
        forkItineraryImpl(testDb, { user: { id: stranger.id } }, { id: created.id }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('copies structure and credit into a new draft with a new slug', async () => {
      const author = await createTestUser()
      const forker = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Chapada Diamantina',
        destination: 'Bahia',
      })
      await updateItineraryImpl(testDb, { user: { id: author.id } }, {
        id: created.id,
        summary: 'A great trip',
        tags: ['adventure'],
      })
      const [day] = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, created.id),
      })
      await testDb.insert(stop).values({
        dayId: day.id,
        position: 1,
        name: 'Poço Azul',
        category: 'attraction',
        description: 'Bring a swimsuit',
      })
      await publishItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })

      const forked = await forkItineraryImpl(testDb, { user: { id: forker.id } }, {
        id: created.id,
      })

      expect(forked.slug).not.toBe(created.slug)

      const forkedRow = await testDb.query.itinerary.findFirst({
        where: eq(itinerary.id, forked.id),
      })
      expect(forkedRow?.authorId).toBe(forker.id)
      expect(forkedRow?.status).toBe('draft')
      expect(forkedRow?.forkedFromId).toBe(created.id)
      expect(forkedRow?.title).toBe('Chapada Diamantina')
      expect(forkedRow?.summary).toBe('A great trip')
      expect(forkedRow?.tags).toEqual(['adventure'])

      const forkedDays = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, forked.id),
      })
      expect(forkedDays).toHaveLength(1)

      const forkedStops = await testDb.query.stop.findMany({
        where: eq(stop.dayId, forkedDays[0].id),
      })
      expect(forkedStops).toHaveLength(1)
      expect(forkedStops[0]?.name).toBe('Poço Azul')
      expect(forkedStops[0]?.description).toBe('Bring a swimsuit')
    })
  })

  describe('searchItinerariesImpl', () => {
    async function publishedItinerary(opts: {
      authorId: string
      title: string
      destination: string
      summary?: string
      tags?: string[]
      extraDays?: number
    }) {
      const created = await createItineraryImpl(testDb, { user: { id: opts.authorId } }, {
        title: opts.title,
        destination: opts.destination,
      })
      if (opts.summary || opts.tags) {
        await updateItineraryImpl(testDb, { user: { id: opts.authorId } }, {
          id: created.id,
          summary: opts.summary,
          tags: opts.tags,
        })
      }
      // day 1 already exists from createItineraryImpl; add any extra days directly.
      for (let n = 2; n <= 1 + (opts.extraDays ?? 0); n++) {
        await testDb.insert(itineraryDay).values({ itineraryId: created.id, dayNumber: n })
      }
      await publishItineraryImpl(testDb, { user: { id: opts.authorId } }, { id: created.id })
      return created
    }

    it('excludes drafts and private itineraries from results', async () => {
      const author = await createTestUser()
      await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Draft trip',
        destination: 'Nowhere',
      })
      const priv = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Private trip',
        destination: 'Nowhere',
      })
      await updateItineraryImpl(testDb, { user: { id: author.id } }, {
        id: priv.id,
        visibility: 'private',
      })
      await publishItineraryImpl(testDb, { user: { id: author.id } }, { id: priv.id })

      const results = await searchItinerariesImpl(testDb, { sort: 'recent', page: 1 })
      expect(results.items).toHaveLength(0)
      expect(results.total).toBe(0)
    })

    it('is empty before publish and matches after publish', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      let results = await searchItinerariesImpl(testDb, { sort: 'recent', page: 1 })
      expect(results.total).toBe(0)

      await publishItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })

      results = await searchItinerariesImpl(testDb, { sort: 'recent', page: 1 })
      expect(results.total).toBe(1)
      expect(results.items[0]?.slug).toBe(created.slug)
      expect(results.items[0]?.dayCount).toBe(1)
    })

    it('matches q against title, destination, or summary (ILIKE)', async () => {
      const author = await createTestUser()
      await publishedItinerary({
        authorId: author.id,
        title: 'Chapada Diamantina Adventure',
        destination: 'Bahia',
      })
      await publishedItinerary({
        authorId: author.id,
        title: 'City break',
        destination: 'Lisbon',
        summary: 'Full of chapadas and waterfalls',
      })
      await publishedItinerary({ authorId: author.id, title: 'Unrelated', destination: 'Tokyo' })

      const byTitle = await searchItinerariesImpl(testDb, {
        q: 'chapada',
        sort: 'recent',
        page: 1,
      })
      expect(byTitle.total).toBe(2)

      const byDestination = await searchItinerariesImpl(testDb, {
        q: 'bahia',
        sort: 'recent',
        page: 1,
      })
      expect(byDestination.total).toBe(1)
      expect(byDestination.items[0]?.destination).toBe('Bahia')
    })

    it('filters by tag overlap', async () => {
      const author = await createTestUser()
      await publishedItinerary({
        authorId: author.id,
        title: 'Adventure trip',
        destination: 'x',
        tags: ['adventure', 'budget'],
      })
      await publishedItinerary({
        authorId: author.id,
        title: 'Food trip',
        destination: 'y',
        tags: ['food'],
      })

      const results = await searchItinerariesImpl(testDb, {
        tags: ['adventure'],
        sort: 'recent',
        page: 1,
      })
      expect(results.total).toBe(1)
      expect(results.items[0]?.title).toBe('Adventure trip')
    })

    it('filters by duration (day count) between minDays and maxDays', async () => {
      const author = await createTestUser()
      const oneDay = await publishedItinerary({
        authorId: author.id,
        title: 'One day trip',
        destination: 'x',
        extraDays: 0,
      })
      const threeDay = await publishedItinerary({
        authorId: author.id,
        title: 'Three day trip',
        destination: 'x',
        extraDays: 2,
      })
      void oneDay

      const results = await searchItinerariesImpl(testDb, {
        minDays: 2,
        maxDays: 5,
        sort: 'recent',
        page: 1,
      })
      expect(results.total).toBe(1)
      expect(results.items[0]?.slug).toBe(threeDay.slug)
    })

    it('sorts by top rating (ratingAvg desc, nulls last, then ratingCount desc)', async () => {
      const author = await createTestUser()
      const rater1 = await createTestUser()
      const rater2 = await createTestUser()

      const unrated = await publishedItinerary({
        authorId: author.id,
        title: 'Unrated trip',
        destination: 'x',
      })
      const highRated = await publishedItinerary({
        authorId: author.id,
        title: 'High rated trip',
        destination: 'x',
      })
      const lowRated = await publishedItinerary({
        authorId: author.id,
        title: 'Low rated trip',
        destination: 'x',
      })

      await testDb.insert(rating).values({ userId: rater1.id, itineraryId: highRated.id, stars: 5 })
      await testDb.insert(rating).values({ userId: rater2.id, itineraryId: highRated.id, stars: 5 })
      await testDb
        .update(itinerary)
        .set({ ratingAvg: '5', ratingCount: 2 })
        .where(eq(itinerary.id, highRated.id))

      await testDb.insert(rating).values({ userId: rater1.id, itineraryId: lowRated.id, stars: 2 })
      await testDb
        .update(itinerary)
        .set({ ratingAvg: '2', ratingCount: 1 })
        .where(eq(itinerary.id, lowRated.id))

      const results = await searchItinerariesImpl(testDb, { sort: 'top', page: 1 })
      expect(results.items.map((i) => i.slug)).toEqual([
        highRated.slug,
        lowRated.slug,
        unrated.slug,
      ])
      expect(results.items[0]?.ratingAvg).toBe(5)
    })

    it('sorts by recent (publishedAt desc) and paginates', async () => {
      const author = await createTestUser()
      const first = await publishedItinerary({ authorId: author.id, title: 'A', destination: 'x' })
      await new Promise((r) => setTimeout(r, 5))
      const second = await publishedItinerary({ authorId: author.id, title: 'B', destination: 'x' })

      const results = await searchItinerariesImpl(testDb, { sort: 'recent', page: 1 })
      expect(results.items.map((i) => i.slug)).toEqual([second.slug, first.slug])
    })
  })
})
