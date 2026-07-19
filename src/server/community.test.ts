import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { itinerary } from '#/db/schema'
import {
  closeTestDb,
  createTestUser,
  resetTestDb,
  setupTestDb,
  testDb,
} from '#/test/db'
import { getCommunityStatsImpl } from './community'

async function insertItinerary(
  authorId: string,
  overrides: Partial<typeof itinerary.$inferInsert> = {},
) {
  const [row] = await testDb
    .insert(itinerary)
    .values({
      authorId,
      title: 'Trip',
      slug: `trip-${Math.random().toString(36).slice(2, 10)}`,
      status: 'published',
      visibility: 'public',
      ...overrides,
    })
    .returning()
  return row
}

describe('getCommunityStatsImpl', () => {
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

  it('counts only published public itineraries and their distinct destinations', async () => {
    const user = await createTestUser()
    await insertItinerary(user.id, { destination: 'Rio de Janeiro' })
    await insertItinerary(user.id, { destination: 'Rio de Janeiro' })
    await insertItinerary(user.id, { destination: 'Paraty' })
    // Drafts, private itineraries, and destination-less rows: the first
    // two never count; the last counts toward itineraryCount only.
    await insertItinerary(user.id, { status: 'draft', destination: 'Salvador' })
    await insertItinerary(user.id, {
      visibility: 'private',
      destination: 'Salvador',
    })
    await insertItinerary(user.id, { destination: null })

    const stats = await getCommunityStatsImpl(testDb)

    expect(stats.itineraryCount).toBe(4)
    expect(stats.destinationCount).toBe(2)
    expect(stats.topDestinations).toEqual([
      { destination: 'Rio de Janeiro', count: 2 },
      { destination: 'Paraty', count: 1 },
    ])
  })

  it('returns zeros on an empty catalog', async () => {
    const stats = await getCommunityStatsImpl(testDb)
    expect(stats).toEqual({
      itineraryCount: 0,
      destinationCount: 0,
      topDestinations: [],
    })
  })
})
