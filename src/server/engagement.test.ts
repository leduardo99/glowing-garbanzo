import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'

import { comment, favorite, itinerary, rating } from '#/db/schema'
import { closeTestDb, createTestUser, resetTestDb, setupTestDb, testDb } from '#/test/db'
import { createItineraryImpl, publishItineraryImpl, updateItineraryImpl } from './itineraries'
import {
  addCommentImpl,
  deleteCommentImpl,
  listCommentsImpl,
  rateItineraryImpl,
  toggleFavoriteImpl,
} from './engagement'

describe('engagement server functions', () => {
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

  async function publishedItinerary(authorId: string) {
    const created = await createItineraryImpl(testDb, { user: { id: authorId } }, {
      title: 'Chapada Diamantina',
      destination: 'Bahia',
    })
    await publishItineraryImpl(testDb, { user: { id: authorId } }, { id: created.id })
    return created
  }

  describe('toggleFavoriteImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await publishedItinerary(author.id)

      await expect(
        toggleFavoriteImpl(testDb, null, { itineraryId: created.id }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects an itinerary with no read access (not found)', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const draft = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Draft trip',
        destination: 'Nowhere',
      })

      await expect(
        toggleFavoriteImpl(testDb, { user: { id: stranger.id } }, { itineraryId: draft.id }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('toggles a row in the database on and off', async () => {
      const author = await createTestUser()
      const fan = await createTestUser()
      const created = await publishedItinerary(author.id)

      const first = await toggleFavoriteImpl(testDb, { user: { id: fan.id } }, {
        itineraryId: created.id,
      })
      expect(first).toEqual({ favorite: true })

      let row = await testDb.query.favorite.findFirst({
        where: and(eq(favorite.userId, fan.id), eq(favorite.itineraryId, created.id)),
      })
      expect(row).toBeDefined()

      const second = await toggleFavoriteImpl(testDb, { user: { id: fan.id } }, {
        itineraryId: created.id,
      })
      expect(second).toEqual({ favorite: false })

      row = await testDb.query.favorite.findFirst({
        where: and(eq(favorite.userId, fan.id), eq(favorite.itineraryId, created.id)),
      })
      expect(row).toBeUndefined()
    })
  })

  describe('rateItineraryImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await publishedItinerary(author.id)

      await expect(
        rateItineraryImpl(testDb, null, { id: created.id, stars: 5 }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects rating a private itinerary the caller cannot read (not found)', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Private trip',
        destination: 'Somewhere',
      })
      await updateItineraryImpl(testDb, { user: { id: author.id } }, {
        id: created.id,
        visibility: 'private',
      })
      await publishItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id })

      await expect(
        rateItineraryImpl(testDb, { user: { id: stranger.id } }, { id: created.id, stars: 5 }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('rejects rating an unpublished (draft) itinerary the caller can read (forbidden)', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Draft trip',
        destination: 'Somewhere',
      })

      // author can read their own draft, but rating requires published+public
      await expect(
        rateItineraryImpl(testDb, { user: { id: author.id } }, { id: created.id, stars: 5 }),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('first rating sets ratingAvg/ratingCount', async () => {
      const author = await createTestUser()
      const rater = await createTestUser()
      const created = await publishedItinerary(author.id)

      const result = await rateItineraryImpl(testDb, { user: { id: rater.id } }, {
        id: created.id,
        stars: 4,
      })
      expect(result).toEqual({ ratingAvg: 4, ratingCount: 1 })

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(parseFloat(row!.ratingAvg!)).toBe(4)
      expect(row?.ratingCount).toBe(1)

      const ratingRow = await testDb.query.rating.findFirst({
        where: and(eq(rating.userId, rater.id), eq(rating.itineraryId, created.id)),
      })
      expect(ratingRow?.stars).toBe(4)
    })

    it('re-rating updates the average without changing the count', async () => {
      const author = await createTestUser()
      const rater1 = await createTestUser()
      const rater2 = await createTestUser()
      const created = await publishedItinerary(author.id)

      await rateItineraryImpl(testDb, { user: { id: rater1.id } }, { id: created.id, stars: 4 })
      await rateItineraryImpl(testDb, { user: { id: rater2.id } }, { id: created.id, stars: 2 })

      let row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.ratingCount).toBe(2)
      expect(parseFloat(row!.ratingAvg!)).toBe(3)

      // rater1 changes their rating from 4 to 2
      const result = await rateItineraryImpl(testDb, { user: { id: rater1.id } }, {
        id: created.id,
        stars: 2,
      })
      expect(result.ratingCount).toBe(2)
      expect(result.ratingAvg).toBe(2)

      row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.ratingCount).toBe(2)
      expect(parseFloat(row!.ratingAvg!)).toBe(2)

      const ratingRows = await testDb.query.rating.findMany({
        where: eq(rating.itineraryId, created.id),
      })
      expect(ratingRows).toHaveLength(2)
    })
  })

  describe('comments', () => {
    it('addCommentImpl rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await publishedItinerary(author.id)

      await expect(
        addCommentImpl(testDb, null, { itineraryId: created.id, body: 'Great trip!' }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('addCommentImpl rejects an itinerary with no read access (not found)', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const draft = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Draft trip',
        destination: 'Nowhere',
      })

      await expect(
        addCommentImpl(testDb, { user: { id: stranger.id } }, {
          itineraryId: draft.id,
          body: 'Hi',
        }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('adds a comment with author fields and lists it newest first, paginated', async () => {
      const author = await createTestUser()
      const commenter1 = await createTestUser('Alice')
      const commenter2 = await createTestUser('Bob')
      const created = await publishedItinerary(author.id)

      const c1 = await addCommentImpl(testDb, { user: { id: commenter1.id } }, {
        itineraryId: created.id,
        body: 'First comment',
      })
      expect(c1.body).toBe('First comment')
      expect(c1.author).toEqual({ id: commenter1.id, name: 'Alice', image: null })

      await new Promise((r) => setTimeout(r, 5))

      const c2 = await addCommentImpl(testDb, { user: { id: commenter2.id } }, {
        itineraryId: created.id,
        body: 'Second comment',
      })
      expect(c2.author.name).toBe('Bob')

      const dbRows = await testDb.query.comment.findMany({ where: eq(comment.itineraryId, created.id) })
      expect(dbRows).toHaveLength(2)

      const page1 = await listCommentsImpl(testDb, null, { itineraryId: created.id, page: 1 })
      expect(page1.total).toBe(2)
      expect(page1.items.map((c) => c.body)).toEqual(['Second comment', 'First comment'])
      expect(page1.items[0]?.author).toEqual({ id: commenter2.id, name: 'Bob', image: null })
    })

    it('listCommentsImpl paginates results', async () => {
      const author = await createTestUser()
      const commenter = await createTestUser()
      const created = await publishedItinerary(author.id)

      for (let i = 0; i < 25; i++) {
        await testDb.insert(comment).values({
          itineraryId: created.id,
          authorId: commenter.id,
          body: `comment ${i}`,
        })
      }

      const page1 = await listCommentsImpl(testDb, null, { itineraryId: created.id, page: 1 })
      expect(page1.total).toBe(25)
      expect(page1.items.length).toBeLessThan(25)

      const page2 = await listCommentsImpl(testDb, null, { itineraryId: created.id, page: 2 })
      expect(page2.items.length).toBeGreaterThan(0)

      const page1Ids = new Set(page1.items.map((c) => c.id))
      const page2Ids = new Set(page2.items.map((c) => c.id))
      for (const id of page2Ids) {
        expect(page1Ids.has(id)).toBe(false)
      }
    })

    it('listCommentsImpl rejects an itinerary with no read access (not found)', async () => {
      const author = await createTestUser()
      const stranger = await createTestUser()
      const draft = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Draft trip',
        destination: 'Nowhere',
      })

      await expect(
        listCommentsImpl(testDb, { user: { id: stranger.id } }, { itineraryId: draft.id, page: 1 }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('deleteCommentImpl lets the author delete their own comment', async () => {
      const author = await createTestUser()
      const commenter = await createTestUser()
      const created = await publishedItinerary(author.id)

      const c1 = await addCommentImpl(testDb, { user: { id: commenter.id } }, {
        itineraryId: created.id,
        body: 'Delete me',
      })

      await deleteCommentImpl(testDb, { user: { id: commenter.id } }, { id: c1.id })

      const row = await testDb.query.comment.findFirst({ where: eq(comment.id, c1.id) })
      expect(row).toBeUndefined()
    })

    it('deleteCommentImpl rejects another user, including the itinerary author', async () => {
      const author = await createTestUser()
      const commenter = await createTestUser()
      const stranger = await createTestUser()
      const created = await publishedItinerary(author.id)

      const c1 = await addCommentImpl(testDb, { user: { id: commenter.id } }, {
        itineraryId: created.id,
        body: 'Cannot delete',
      })

      await expect(
        deleteCommentImpl(testDb, { user: { id: stranger.id } }, { id: c1.id }),
      ).rejects.toThrow('FORBIDDEN')

      // the itinerary author cannot delete someone else's comment either
      await expect(
        deleteCommentImpl(testDb, { user: { id: author.id } }, { id: c1.id }),
      ).rejects.toThrow('FORBIDDEN')

      const row = await testDb.query.comment.findFirst({ where: eq(comment.id, c1.id) })
      expect(row).toBeDefined()
    })

    it('deleteCommentImpl rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const commenter = await createTestUser()
      const created = await publishedItinerary(author.id)

      const c1 = await addCommentImpl(testDb, { user: { id: commenter.id } }, {
        itineraryId: created.id,
        body: 'x',
      })

      await expect(deleteCommentImpl(testDb, null, { id: c1.id })).rejects.toThrow('UNAUTHORIZED')
    })

    it('deleteCommentImpl throws not found for an unknown comment id', async () => {
      const author = await createTestUser()
      await expect(
        deleteCommentImpl(testDb, { user: { id: author.id } }, { id: 'does-not-exist' }),
      ).rejects.toThrow('NOT_FOUND')
    })
  })
})
