import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { NoObjectGeneratedError, generateObject } from 'ai'

import { aiGeneration, itinerary, itineraryDay, stop } from '#/db/schema'
import {
  closeTestDb,
  createTestUser,
  resetTestDb,
  setupTestDb,
  testDb,
} from '#/test/db'
import {
  AI_DAILY_GENERATION_LIMIT,
  generateItineraryDraftImpl,
  getAiAvailabilityImpl,
} from './ai'
import type { GenerateItineraryDraftInput } from './ai'
import type { AiItineraryDraft } from './domain/ai-draft'
import {
  ERR_AI_GENERATION_FAILED,
  ERR_AI_QUOTA_EXCEEDED,
  ERR_UNAUTHORIZED,
} from './errors'

// The provider is never reached in tests (network-restricted dev): the AI
// SDK's `generateObject` is module-mocked, keeping the real
// `NoObjectGeneratedError` class so `isInstance` checks still work.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...(actual as object), generateObject: vi.fn() }
})
vi.mock('@ai-sdk/google', () => ({
  createGoogle: () => () => ({ modelId: 'mocked' }),
}))

const generateObjectMock = vi.mocked(generateObject)

const validDraft: AiItineraryDraft = {
  title: 'Três dias em Salvador',
  summary: 'Pelourinho, praias e acarajé.',
  tags: ['beach', 'culture'],
  days: [
    {
      title: 'Centro Histórico',
      note: 'Comece cedo.',
      stops: [
        { name: 'Pelourinho', category: 'attraction', description: 'Casario colonial.', costCents: 0 },
        { name: 'Acarajé da Dinha', category: 'food', costCents: 2500 },
      ],
    },
    {
      stops: [{ name: 'Praia do Porto da Barra', category: 'attraction' }],
    },
  ],
}

function makeInput(overrides: Partial<GenerateItineraryDraftInput> = {}): GenerateItineraryDraftInput {
  return {
    destination: 'Salvador, Bahia',
    days: 2,
    styles: ['culture'],
    geocode: false,
    locale: 'pt-BR',
    ...overrides,
  }
}

function makeSchemaValidationError() {
  return new NoObjectGeneratedError({
    message: 'response did not match schema',
    response: { id: 'resp-1', timestamp: new Date(), modelId: 'mocked' },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    } as never,
    finishReason: 'stop',
  })
}

async function seedGenerations(userId: string, count: number, createdAt?: Date) {
  for (let i = 0; i < count; i++) {
    await testDb.insert(aiGeneration).values(createdAt ? { userId, createdAt } : { userId })
  }
}

describe('AI itinerary generation server functions', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  beforeEach(async () => {
    await resetTestDb()
    generateObjectMock.mockReset()
  })

  afterAll(async () => {
    await resetTestDb()
    await closeTestDb()
  })

  describe('generateItineraryDraftImpl', () => {
    it('requires a session', async () => {
      await expect(
        generateItineraryDraftImpl(testDb, null, makeInput()),
      ).rejects.toThrow(ERR_UNAUTHORIZED)
      expect(generateObjectMock).not.toHaveBeenCalled()
    })

    it('persists itinerary, days, stops, and the quota row in one shot on success', async () => {
      const user = await createTestUser()
      generateObjectMock.mockResolvedValue({ object: validDraft } as never)

      const result = await generateItineraryDraftImpl(
        testDb,
        { user: { id: user.id } },
        makeInput(),
      )

      const row = await testDb.query.itinerary.findFirst({
        where: eq(itinerary.id, result.id),
      })
      expect(row).toMatchObject({
        authorId: user.id,
        title: 'Três dias em Salvador',
        summary: 'Pelourinho, praias e acarajé.',
        destination: 'Salvador, Bahia',
        tags: ['beach', 'culture'],
        status: 'draft',
      })
      expect(row!.slug).toMatch(/^tres-dias-em-salvador-/)

      const days = await testDb.query.itineraryDay.findMany({
        where: eq(itineraryDay.itineraryId, result.id),
        orderBy: itineraryDay.dayNumber,
      })
      expect(days.map((d) => d.dayNumber)).toEqual([1, 2])
      expect(days[0].title).toBe('Centro Histórico')
      expect(days[1].title).toBeNull()

      const day1Stops = await testDb.query.stop.findMany({
        where: eq(stop.dayId, days[0].id),
        orderBy: stop.position,
      })
      expect(day1Stops.map((s) => [s.position, s.name, s.category])).toEqual([
        [1, 'Pelourinho', 'attraction'],
        [2, 'Acarajé da Dinha', 'food'],
      ])
      // No geocode opt-in: stops come back without pins.
      expect(day1Stops.every((s) => s.lat === null && s.lng === null)).toBe(true)

      const quotaRows = await testDb.query.aiGeneration.findMany({
        where: eq(aiGeneration.userId, user.id),
      })
      expect(quotaRows).toHaveLength(1)
    })

    it('allows the 5th generation of the day and rejects the 6th before calling the provider', async () => {
      const user = await createTestUser()
      generateObjectMock.mockResolvedValue({ object: validDraft } as never)

      await seedGenerations(user.id, AI_DAILY_GENERATION_LIMIT - 1)
      await generateItineraryDraftImpl(testDb, { user: { id: user.id } }, makeInput())
      expect(generateObjectMock).toHaveBeenCalledTimes(1)

      await expect(
        generateItineraryDraftImpl(testDb, { user: { id: user.id } }, makeInput()),
      ).rejects.toThrow(ERR_AI_QUOTA_EXCEEDED)
      expect(generateObjectMock).toHaveBeenCalledTimes(1)
    })

    it('does not count yesterday\'s generations against today\'s quota', async () => {
      const user = await createTestUser()
      generateObjectMock.mockResolvedValue({ object: validDraft } as never)

      const startOfTodayUtc = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
      )
      const justBeforeMidnight = new Date(startOfTodayUtc.getTime() - 60_000)
      await seedGenerations(user.id, AI_DAILY_GENERATION_LIMIT, justBeforeMidnight)

      await expect(
        generateItineraryDraftImpl(testDb, { user: { id: user.id } }, makeInput()),
      ).resolves.toMatchObject({ id: expect.any(String) })
    })

    it('retries once on schema-validation failure and succeeds', async () => {
      const user = await createTestUser()
      generateObjectMock
        .mockRejectedValueOnce(makeSchemaValidationError())
        .mockResolvedValueOnce({ object: validDraft } as never)

      await expect(
        generateItineraryDraftImpl(testDb, { user: { id: user.id } }, makeInput()),
      ).resolves.toMatchObject({ id: expect.any(String) })
      expect(generateObjectMock).toHaveBeenCalledTimes(2)
    })

    it('fails with AI_GENERATION_FAILED after two schema-validation failures, persisting nothing', async () => {
      const user = await createTestUser()
      generateObjectMock.mockRejectedValue(makeSchemaValidationError())

      await expect(
        generateItineraryDraftImpl(testDb, { user: { id: user.id } }, makeInput()),
      ).rejects.toThrow(ERR_AI_GENERATION_FAILED)
      expect(generateObjectMock).toHaveBeenCalledTimes(2)

      expect(await testDb.query.itinerary.findMany()).toHaveLength(0)
      expect(await testDb.query.aiGeneration.findMany()).toHaveLength(0)
    })

    it('fails immediately (no retry, no quota consumed) on a provider error', async () => {
      const user = await createTestUser()
      generateObjectMock.mockRejectedValue(new Error('503 from provider'))

      await expect(
        generateItineraryDraftImpl(testDb, { user: { id: user.id } }, makeInput()),
      ).rejects.toThrow(ERR_AI_GENERATION_FAILED)
      expect(generateObjectMock).toHaveBeenCalledTimes(1)
      expect(await testDb.query.aiGeneration.findMany()).toHaveLength(0)
    })
  })

  describe('getAiAvailabilityImpl', () => {
    it('requires a session', async () => {
      await expect(getAiAvailabilityImpl(testDb, null)).rejects.toThrow(ERR_UNAUTHORIZED)
    })

    it('reports the key as configured and decrements remainingToday per success', async () => {
      const user = await createTestUser()
      const before = await getAiAvailabilityImpl(testDb, { user: { id: user.id } })
      expect(before).toEqual({ enabled: true, remainingToday: AI_DAILY_GENERATION_LIMIT })

      generateObjectMock.mockResolvedValue({ object: validDraft } as never)
      await generateItineraryDraftImpl(testDb, { user: { id: user.id } }, makeInput())

      const after = await getAiAvailabilityImpl(testDb, { user: { id: user.id } })
      expect(after.remainingToday).toBe(AI_DAILY_GENERATION_LIMIT - 1)
    })

    it('never reports a negative remainingToday', async () => {
      const user = await createTestUser()
      await seedGenerations(user.id, AI_DAILY_GENERATION_LIMIT + 2)
      const availability = await getAiAvailabilityImpl(testDb, { user: { id: user.id } })
      expect(availability.remainingToday).toBe(0)
    })
  })
})
