import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'

import { itineraryDay, stop } from '#/db/schema'
import { closeTestDb, createTestUser, resetTestDb, setupTestDb, testDb } from '#/test/db'
import { createItineraryImpl } from './itineraries'
import {
  addDayImpl,
  addStopImpl,
  moveStopToDayImpl,
  removeDayImpl,
  removeStopImpl,
  reorderStopsImpl,
  updateDayImpl,
  updateStopImpl,
} from './days-stops'

describe('days-stops server functions', () => {
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

  async function daysOf(itineraryId: string) {
    return testDb.query.itineraryDay.findMany({
      where: eq(itineraryDay.itineraryId, itineraryId),
      orderBy: asc(itineraryDay.dayNumber),
    })
  }

  async function stopsOf(dayId: string) {
    return testDb.query.stop.findMany({ where: eq(stop.dayId, dayId), orderBy: asc(stop.position) })
  }

  describe('addDayImpl', () => {
    it('appends as the next dayNumber', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      }) // already has day 1

      const day2 = await addDayImpl(testDb, { user: { id: author.id } }, {
        itineraryId: created.id,
        title: 'Day two',
      })
      expect(day2.dayNumber).toBe(2)

      const day3 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })
      expect(day3.dayNumber).toBe(3)

      const days = await daysOf(created.id)
      expect(days.map((d) => d.dayNumber)).toEqual([1, 2, 3])
      expect(days[1]?.title).toBe('Day two')
    })

    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      await expect(
        addDayImpl(testDb, null, { itineraryId: created.id }),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      await expect(
        addDayImpl(testDb, { user: { id: other.id } }, { itineraryId: created.id }),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('throws not found for an unknown itinerary', async () => {
      const author = await createTestUser()
      await expect(
        addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: 'does-not-exist' }),
      ).rejects.toThrow('NOT_FOUND')
    })
  })

  describe('removeDayImpl', () => {
    it('deletes the day and renumbers subsequent days', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const day2 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })
      const day3 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })
      const day4 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })
      void day4

      await removeDayImpl(testDb, { user: { id: author.id } }, { id: day2.id })

      const days = await daysOf(created.id)
      expect(days.map((d) => d.dayNumber)).toEqual([1, 2, 3])
      // day3 and day4 (originally 3, 4) shifted down to 2, 3; day2 is gone.
      const ids = days.map((d) => d.id)
      expect(ids).not.toContain(day2.id)
      expect(ids).toContain(day3.id)
      const shiftedDay3 = days.find((d) => d.id === day3.id)
      expect(shiftedDay3?.dayNumber).toBe(2)
    })

    it('cascades stop deletion for the removed day', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const addedStop = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'Some stop',
        category: 'food',
      })

      await removeDayImpl(testDb, { user: { id: author.id } }, { id: day1.id })

      const remaining = await testDb.query.stop.findFirst({ where: eq(stop.id, addedStop.id) })
      expect(remaining).toBeUndefined()
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)

      await expect(
        removeDayImpl(testDb, { user: { id: other.id } }, { id: day1.id }),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('throws not found for an unknown day', async () => {
      const author = await createTestUser()
      await expect(
        removeDayImpl(testDb, { user: { id: author.id } }, { id: 'does-not-exist' }),
      ).rejects.toThrow('NOT_FOUND')
    })
  })

  describe('updateDayImpl', () => {
    it('updates title/note', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)

      await updateDayImpl(testDb, { user: { id: author.id } }, {
        id: day1.id,
        title: 'New title',
        note: 'A note',
      })

      const row = await testDb.query.itineraryDay.findFirst({ where: eq(itineraryDay.id, day1.id) })
      expect(row?.title).toBe('New title')
      expect(row?.note).toBe('A note')
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)

      await expect(
        updateDayImpl(testDb, { user: { id: other.id } }, { id: day1.id, title: 'Hijacked' }),
      ).rejects.toThrow('FORBIDDEN')
    })
  })

  describe('addStopImpl', () => {
    it('persists and updates the optional start time', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)

      const created1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'Timed stop',
        category: 'attraction',
        startTime: '09:30',
      })
      let [row] = await stopsOf(day1.id)
      // pg `time` round-trips with seconds appended.
      expect(row.startTime).toBe('09:30:00')

      await updateStopImpl(testDb, { user: { id: author.id } }, {
        id: created1.id,
        startTime: '17:45',
      })
      ;[row] = await stopsOf(day1.id)
      expect(row.startTime).toBe('17:45:00')

      await updateStopImpl(testDb, { user: { id: author.id } }, {
        id: created1.id,
        startTime: null,
      })
      ;[row] = await stopsOf(day1.id)
      expect(row.startTime).toBeNull()

      await expect(
        addStopImpl(testDb, { user: { id: author.id } }, {
          dayId: day1.id,
          name: 'Bad time',
          category: 'other',
          startTime: '25:99',
        }),
      ).rejects.toThrow()
    })

    it('appends stops at increasing end positions', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)

      const s1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'First',
        category: 'attraction',
      })
      const s2 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'Second',
        category: 'food',
      })
      expect(s1.position).toBe(0)
      expect(s2.position).toBe(1)

      const stops = await stopsOf(day1.id)
      expect(stops.map((s) => s.name)).toEqual(['First', 'Second'])
    })

    it('appends after existing max position even with gaps from removal', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)

      const s1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'First',
        category: 'attraction',
      })
      const s2 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'Second',
        category: 'food',
      })
      await removeStopImpl(testDb, { user: { id: author.id } }, { id: s1.id })

      const s3 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'Third',
        category: 'lodging',
      })
      expect(s3.position).toBeGreaterThan(s2.position)
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)

      await expect(
        addStopImpl(testDb, { user: { id: other.id } }, {
          dayId: day1.id,
          name: 'Nope',
          category: 'attraction',
        }),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('rejects out-of-range lat/lng', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)

      await expect(
        addStopImpl(testDb, { user: { id: author.id } }, {
          dayId: day1.id,
          name: 'Bad lat',
          category: 'attraction',
          lat: 91,
          lng: 0,
        }),
      ).rejects.toThrow()

      await expect(
        addStopImpl(testDb, { user: { id: author.id } }, {
          dayId: day1.id,
          name: 'Bad lng',
          category: 'attraction',
          lat: 0,
          lng: 181,
        }),
      ).rejects.toThrow()
    })
  })

  describe('updateStopImpl', () => {
    it('updates fields', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const s1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'First',
        category: 'attraction',
      })

      await updateStopImpl(testDb, { user: { id: author.id } }, {
        id: s1.id,
        name: 'Renamed',
        costCents: 1500,
        lat: -12.9,
        lng: -38.5,
        placeLabel: 'Somewhere',
      })

      const row = await testDb.query.stop.findFirst({ where: eq(stop.id, s1.id) })
      expect(row?.name).toBe('Renamed')
      expect(row?.costCents).toBe(1500)
      expect(row?.lat).toBe(-12.9)
      expect(row?.lng).toBe(-38.5)
      expect(row?.placeLabel).toBe('Somewhere')
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const s1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'First',
        category: 'attraction',
      })

      await expect(
        updateStopImpl(testDb, { user: { id: other.id } }, { id: s1.id, name: 'Hijacked' }),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('rejects out-of-range lat/lng', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const s1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'First',
        category: 'attraction',
      })

      await expect(
        updateStopImpl(testDb, { user: { id: author.id } }, { id: s1.id, lat: -91, lng: 0 }),
      ).rejects.toThrow()

      await expect(
        updateStopImpl(testDb, { user: { id: author.id } }, { id: s1.id, lat: 0, lng: -181 }),
      ).rejects.toThrow()
    })
  })

  describe('removeStopImpl', () => {
    it('deletes the stop', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const s1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'First',
        category: 'attraction',
      })

      await removeStopImpl(testDb, { user: { id: author.id } }, { id: s1.id })

      const row = await testDb.query.stop.findFirst({ where: eq(stop.id, s1.id) })
      expect(row).toBeUndefined()
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const s1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'First',
        category: 'attraction',
      })

      await expect(
        removeStopImpl(testDb, { user: { id: other.id } }, { id: s1.id }),
      ).rejects.toThrow('FORBIDDEN')
    })
  })

  describe('reorderStopsImpl', () => {
    async function threeStops(authorId: string, dayId: string) {
      const s1 = await addStopImpl(testDb, { user: { id: authorId } }, {
        dayId,
        name: 'A',
        category: 'attraction',
      })
      const s2 = await addStopImpl(testDb, { user: { id: authorId } }, {
        dayId,
        name: 'B',
        category: 'food',
      })
      const s3 = await addStopImpl(testDb, { user: { id: authorId } }, {
        dayId,
        name: 'C',
        category: 'lodging',
      })
      return [s1, s2, s3]
    }

    it('persists the new order as positions 0..n', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const [s1, s2, s3] = await threeStops(author.id, day1.id)

      await reorderStopsImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        stopIds: [s3.id, s1.id, s2.id],
      })

      const stops = await stopsOf(day1.id)
      expect(stops.map((s) => s.id)).toEqual([s3.id, s1.id, s2.id])
      expect(stops.map((s) => s.position)).toEqual([0, 1, 2])
    })

    it('rejects a stopId that belongs to a different day', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const day2 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })
      const [s1, s2] = await threeStops(author.id, day1.id)
      const otherDayStop = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day2.id,
        name: 'Foreign',
        category: 'other',
      })

      await expect(
        reorderStopsImpl(testDb, { user: { id: author.id } }, {
          dayId: day1.id,
          stopIds: [s1.id, s2.id, otherDayStop.id],
        }),
      ).rejects.toThrow('NOT_FOUND')

      // Nothing was written.
      const stops = await stopsOf(day1.id)
      expect(stops.map((s) => s.position)).toEqual([0, 1, 2])
    })

    it('rejects a stopId set that is missing a stop from the day', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const [s1, s2] = await threeStops(author.id, day1.id)

      await expect(
        reorderStopsImpl(testDb, { user: { id: author.id } }, {
          dayId: day1.id,
          stopIds: [s1.id, s2.id],
        }),
      ).rejects.toThrow('NOT_FOUND')
    })

    it('rejects a stopIds list containing a duplicate id', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const [s1, s2, s3] = await threeStops(author.id, day1.id)
      void s3

      await expect(
        reorderStopsImpl(testDb, { user: { id: author.id } }, {
          dayId: day1.id,
          // s1 repeated in place of s3: same length as the day's stop count,
          // but a duplicate, so the set size check must catch it.
          stopIds: [s1.id, s2.id, s1.id],
        }),
      ).rejects.toThrow('NOT_FOUND')

      // Nothing was written.
      const stops = await stopsOf(day1.id)
      expect(stops.map((s) => s.id)).toEqual([s1.id, s2.id, s3.id])
      expect(stops.map((s) => s.position)).toEqual([0, 1, 2])
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const [s1, s2, s3] = await threeStops(author.id, day1.id)

      await expect(
        reorderStopsImpl(testDb, { user: { id: other.id } }, {
          dayId: day1.id,
          stopIds: [s3.id, s2.id, s1.id],
        }),
      ).rejects.toThrow('FORBIDDEN')
    })
  })

  describe('moveStopToDayImpl', () => {
    it('moves a stop across days, normalizing positions on both sides', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const day2 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })

      const a1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'A1',
        category: 'attraction',
      })
      const a2 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'A2',
        category: 'food',
      })
      const b1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day2.id,
        name: 'B1',
        category: 'lodging',
      })

      await moveStopToDayImpl(testDb, { user: { id: author.id } }, {
        stopId: a1.id,
        targetDayId: day2.id,
        position: 0,
      })

      const day1Stops = await stopsOf(day1.id)
      expect(day1Stops.map((s) => s.id)).toEqual([a2.id])
      expect(day1Stops.map((s) => s.position)).toEqual([0])

      const day2Stops = await stopsOf(day2.id)
      expect(day2Stops.map((s) => s.id)).toEqual([a1.id, b1.id])
      expect(day2Stops.map((s) => s.position)).toEqual([0, 1])

      const movedRow = await testDb.query.stop.findFirst({ where: eq(stop.id, a1.id) })
      expect(movedRow?.dayId).toBe(day2.id)
    })

    it('clamps an out-of-range position to the end of the target day', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const day2 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })

      const a1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'A1',
        category: 'attraction',
      })
      const b1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day2.id,
        name: 'B1',
        category: 'lodging',
      })

      await moveStopToDayImpl(testDb, { user: { id: author.id } }, {
        stopId: a1.id,
        targetDayId: day2.id,
        position: 999,
      })

      const day2Stops = await stopsOf(day2.id)
      expect(day2Stops.map((s) => s.id)).toEqual([b1.id, a1.id])
    })

    it('repositions a stop within its current day, leaving other days untouched', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const day2 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })

      const a = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'A',
        category: 'attraction',
      })
      const b = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'B',
        category: 'food',
      })
      const c = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'C',
        category: 'lodging',
      })
      const other = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day2.id,
        name: 'Other',
        category: 'transport',
      })

      await moveStopToDayImpl(testDb, { user: { id: author.id } }, {
        stopId: c.id,
        targetDayId: day1.id,
        position: 0,
      })

      const day1Stops = await stopsOf(day1.id)
      expect(day1Stops.map((s) => s.id)).toEqual([c.id, a.id, b.id])
      expect(day1Stops.map((s) => s.position)).toEqual([0, 1, 2])

      const day2Stops = await stopsOf(day2.id)
      expect(day2Stops.map((s) => s.id)).toEqual([other.id])
      expect(day2Stops.map((s) => s.position)).toEqual([0])

      const movedRow = await testDb.query.stop.findFirst({ where: eq(stop.id, c.id) })
      expect(movedRow?.dayId).toBe(day1.id)
    })

    it('rejects moving to a day in a different itinerary', async () => {
      const author = await createTestUser()
      const itineraryA = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'A',
        destination: 'x',
      })
      const itineraryB = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'B',
        destination: 'y',
      })
      const [dayA] = await daysOf(itineraryA.id)
      const [dayB] = await daysOf(itineraryB.id)
      const stopA = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: dayA.id,
        name: 'A1',
        category: 'attraction',
      })

      await expect(
        moveStopToDayImpl(testDb, { user: { id: author.id } }, {
          stopId: stopA.id,
          targetDayId: dayB.id,
          position: 0,
        }),
      ).rejects.toThrow('FORBIDDEN')

      const row = await testDb.query.stop.findFirst({ where: eq(stop.id, stopA.id) })
      expect(row?.dayId).toBe(dayA.id)
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'x',
        destination: 'y',
      })
      const [day1] = await daysOf(created.id)
      const day2 = await addDayImpl(testDb, { user: { id: author.id } }, { itineraryId: created.id })
      const a1 = await addStopImpl(testDb, { user: { id: author.id } }, {
        dayId: day1.id,
        name: 'A1',
        category: 'attraction',
      })

      await expect(
        moveStopToDayImpl(testDb, { user: { id: other.id } }, {
          stopId: a1.id,
          targetDayId: day2.id,
          position: 0,
        }),
      ).rejects.toThrow('FORBIDDEN')
    })
  })
})
