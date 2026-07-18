import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { itinerary, user } from '#/db/schema'
import { createTestUser, resetTestDb, setupTestDb, testDb } from './db'

describe('test db harness', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await resetTestDb()
  })

  it('persists and reads back real rows, then reset empties every table', async () => {
    const testUser = await createTestUser()

    const [inserted] = await testDb
      .insert(itinerary)
      .values({
        authorId: testUser.id,
        title: 'Weekend in Lisbon',
        slug: `weekend-in-lisbon-${testUser.id}`,
      })
      .returning()

    expect(inserted).toBeDefined()

    const readBack = await testDb.query.itinerary.findFirst({
      where: eq(itinerary.id, inserted.id),
    })
    expect(readBack?.title).toBe('Weekend in Lisbon')
    expect(readBack?.authorId).toBe(testUser.id)

    await resetTestDb()

    const itinerariesAfterReset = await testDb.select().from(itinerary)
    expect(itinerariesAfterReset).toEqual([])

    const usersAfterReset = await testDb.select().from(user)
    expect(usersAfterReset).toEqual([])
  })
})
