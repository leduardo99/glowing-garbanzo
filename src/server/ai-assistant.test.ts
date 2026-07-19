import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { generateObject } from 'ai'

import { aiGeneration, itinerary, itineraryDay, stop } from '#/db/schema'
import {
  closeTestDb,
  createTestUser,
  resetTestDb,
  setupTestDb,
  testDb,
} from '#/test/db'
import {
  adviseItineraryChangeImpl,
  applyItineraryPatchImpl,
} from './ai-assistant'
import { createItineraryImpl } from './itineraries'
import {
  ERR_AI_PATCH_INVALID,
  ERR_AI_QUOTA_EXCEEDED,
  ERR_FORBIDDEN,
} from './errors'

// Same module-mock pattern as ai.test.ts: the provider is never reached.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...(actual as object), generateObject: vi.fn() }
})
vi.mock('@ai-sdk/google', () => ({
  createGoogle: () => () => ({ modelId: 'mocked' }),
}))

const generateObjectMock = vi.mocked(generateObject)

describe('ai assistant', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  beforeEach(async () => {
    await resetTestDb()
    generateObjectMock.mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  afterAll(async () => {
    await resetTestDb()
    await closeTestDb()
  })

  async function seedItinerary(authorId: string) {
    const created = await createItineraryImpl(
      testDb,
      { user: { id: authorId } },
      { title: 'Base trip', destination: 'Salvador' },
    )
    const [day1] = await testDb
      .select()
      .from(itineraryDay)
      .where(eq(itineraryDay.itineraryId, created.id))
    await testDb.insert(stop).values([
      { dayId: day1.id, position: 0, name: 'Pelourinho', category: 'attraction' },
      { dayId: day1.id, position: 1, name: 'Acarajé da Dinha', category: 'food' },
    ])
    return { id: created.id, day1Id: day1.id }
  }

  describe('applyItineraryPatchImpl', () => {
    it('applies ops in order against the evolving state and consumes quota', async () => {
      const author = await createTestUser()
      const seeded = await seedItinerary(author.id)

      await applyItineraryPatchImpl(testDb, { user: { id: author.id } }, {
        itineraryId: seeded.id,
        ops: [
          { op: 'set_title', title: 'Salvador de verdade' },
          { op: 'add_day', title: 'Praias', note: null },
          { op: 'add_stop', dayNumber: 2, name: 'Porto da Barra', category: 'attraction', startTime: '09:00', costCents: 0 },
          { op: 'update_stop', dayNumber: 1, position: 2, costCents: 2500 },
          { op: 'remove_stop', dayNumber: 1, position: 1 },
        ],
      })

      const [row] = await testDb
        .select()
        .from(itinerary)
        .where(eq(itinerary.id, seeded.id))
      expect(row.title).toBe('Salvador de verdade')

      const days = await testDb
        .select()
        .from(itineraryDay)
        .where(eq(itineraryDay.itineraryId, seeded.id))
        .orderBy(asc(itineraryDay.dayNumber))
      expect(days).toHaveLength(2)
      expect(days[1].title).toBe('Praias')

      const day1Stops = await testDb
        .select()
        .from(stop)
        .where(eq(stop.dayId, seeded.day1Id))
        .orderBy(asc(stop.position))
      // Pelourinho was removed (position 1); Acarajé compacted to front
      // and got the cost update that targeted it at position 2.
      expect(day1Stops.map((s) => s.name)).toEqual(['Acarajé da Dinha'])
      expect(day1Stops[0].position).toBe(0)
      expect(day1Stops[0].costCents).toBe(2500)

      const day2Stops = await testDb
        .select()
        .from(stop)
        .where(eq(stop.dayId, days[1].id))
      expect(day2Stops.map((s) => s.name)).toEqual(['Porto da Barra'])
      expect(day2Stops[0].startTime).toBe('09:00:00')

      const quota = await testDb
        .select()
        .from(aiGeneration)
        .where(eq(aiGeneration.userId, author.id))
      expect(quota).toHaveLength(1)
    })

    it('rolls everything back when an op references a missing target', async () => {
      const author = await createTestUser()
      const seeded = await seedItinerary(author.id)

      await expect(
        applyItineraryPatchImpl(testDb, { user: { id: author.id } }, {
          itineraryId: seeded.id,
          ops: [
            { op: 'set_title', title: 'Should not persist' },
            { op: 'remove_stop', dayNumber: 9, position: 1 },
          ],
        }),
      ).rejects.toThrow(ERR_AI_PATCH_INVALID)

      const [row] = await testDb
        .select()
        .from(itinerary)
        .where(eq(itinerary.id, seeded.id))
      expect(row.title).toBe('Base trip')
      const quota = await testDb
        .select()
        .from(aiGeneration)
        .where(eq(aiGeneration.userId, author.id))
      expect(quota).toHaveLength(0)
    })

    it('enforces the shared daily quota and authorship', async () => {
      const author = await createTestUser()
      const other = await createTestUser('Other')
      const seeded = await seedItinerary(author.id)

      await expect(
        applyItineraryPatchImpl(testDb, { user: { id: other.id } }, {
          itineraryId: seeded.id,
          ops: [{ op: 'add_day' }],
        }),
      ).rejects.toThrow(ERR_FORBIDDEN)

      await testDb
        .insert(aiGeneration)
        .values(Array.from({ length: 5 }, () => ({ userId: author.id })))
      await expect(
        applyItineraryPatchImpl(testDb, { user: { id: author.id } }, {
          itineraryId: seeded.id,
          ops: [{ op: 'add_day' }],
        }),
      ).rejects.toThrow(ERR_AI_QUOTA_EXCEEDED)
    })

    it('rejects ops outside the schema before touching anything', async () => {
      const author = await createTestUser()
      const seeded = await seedItinerary(author.id)
      await expect(
        applyItineraryPatchImpl(testDb, { user: { id: author.id } }, {
          itineraryId: seeded.id,
          // @ts-expect-error — deliberately malformed op
          ops: [{ op: 'drop_table', table: 'itinerary' }],
        }),
      ).rejects.toThrow()
    })
  })

  describe('adviseItineraryChangeImpl', () => {
    it('returns the structured response and never consumes quota', async () => {
      const author = await createTestUser()
      const seeded = await seedItinerary(author.id)
      generateObjectMock.mockResolvedValueOnce({
        object: {
          reply: 'Troquei o dia 1 por praias.',
          patch: {
            summary: 'Substitui as paradas do dia 1 por praias.',
            ops: [
              { op: 'remove_stop', dayNumber: 1, position: 1 },
              { op: 'add_stop', dayNumber: 1, name: 'Praia do Forte', category: 'attraction' },
            ],
          },
        },
      } as never)

      const response = await adviseItineraryChangeImpl(
        testDb,
        { user: { id: author.id } },
        {
          itineraryId: seeded.id,
          messages: [{ role: 'user', content: 'troca o dia 1 por praias' }],
          locale: 'pt-BR',
        },
      )

      expect(response.reply).toContain('praias')
      expect(response.patch?.ops).toHaveLength(2)
      // The prompt carried the current state (1-based positions).
      const prompt = generateObjectMock.mock.calls[0][0].prompt as string
      expect(prompt).toContain('Pelourinho')
      expect(prompt).toContain('"position":1')

      const quota = await testDb
        .select()
        .from(aiGeneration)
        .where(eq(aiGeneration.userId, author.id))
      expect(quota).toHaveLength(0)
    })
  })
})
