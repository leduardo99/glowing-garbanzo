import { describe, expect, it } from 'vitest'

import { buildForkRows } from './fork'
import type { StopCopy } from './fork'

function stop(overrides: Partial<StopCopy> = {}): StopCopy {
  return {
    position: 0,
    name: 'Museu Nacional',
    category: 'attraction',
    description: 'A history museum',
    costCents: 1500,
    lat: -22.9,
    lng: -43.2,
    placeLabel: 'Museu Nacional, Rio de Janeiro',
    ...overrides,
  }
}

const source = {
  itinerary: {
    title: '7 Days in Chapada',
    summary: 'A trip through the highlands',
    destination: 'Chapada Diamantina',
    tags: ['nature', 'hiking'],
    coverImageUrl: 'https://example.com/cover.jpg',
  },
  days: [
    {
      dayNumber: 1,
      title: 'Arrival',
      note: 'Take it easy',
      stops: [
        stop({ position: 0, name: 'Airport' }),
        stop({ position: 1, name: 'Hotel' }),
      ],
    },
    {
      dayNumber: 2,
      title: 'Waterfalls',
      note: null,
      stops: [stop({ position: 0, name: 'Fumaça Falls' })],
    },
  ],
}

describe('buildForkRows', () => {
  it('copies the itinerary fields for the new owner', () => {
    const result = buildForkRows(
      source,
      'new-owner-id',
      'source-itinerary-id',
      'new-slug-abc123',
    )
    expect(result.itinerary.title).toBe(source.itinerary.title)
    expect(result.itinerary.summary).toBe(source.itinerary.summary)
    expect(result.itinerary.destination).toBe(source.itinerary.destination)
    expect(result.itinerary.tags).toEqual(source.itinerary.tags)
    expect(result.itinerary.coverImageUrl).toBe(source.itinerary.coverImageUrl)
    expect(result.itinerary.authorId).toBe('new-owner-id')
    expect(result.itinerary.slug).toBe('new-slug-abc123')
  })

  it('resets the forked itinerary to draft status', () => {
    const result = buildForkRows(
      source,
      'new-owner-id',
      'source-itinerary-id',
      'new-slug-abc123',
    )
    expect(result.itinerary.status).toBe('draft')
  })

  it('credits the source itinerary via forkedFromId', () => {
    const result = buildForkRows(
      source,
      'new-owner-id',
      'source-itinerary-id',
      'new-slug-abc123',
    )
    expect(result.itinerary.forkedFromId).toBe('source-itinerary-id')
  })

  it('copies all days with their stops in order', () => {
    const result = buildForkRows(
      source,
      'new-owner-id',
      'source-itinerary-id',
      'new-slug-abc123',
    )
    expect(result.days).toHaveLength(2)
    expect(result.days[0]).toMatchObject({
      dayNumber: 1,
      title: 'Arrival',
      note: 'Take it easy',
    })
    expect(result.days[0]?.stops).toHaveLength(2)
    expect(result.days[0]?.stops[0]).toMatchObject({
      name: 'Airport',
      position: 0,
    })
    expect(result.days[0]?.stops[1]).toMatchObject({
      name: 'Hotel',
      position: 1,
    })
    expect(result.days[1]).toMatchObject({
      dayNumber: 2,
      title: 'Waterfalls',
      note: null,
    })
    expect(result.days[1]?.stops).toHaveLength(1)
  })

  it('does not mutate the source data', () => {
    const original = JSON.parse(JSON.stringify(source)) as typeof source
    buildForkRows(
      source,
      'new-owner-id',
      'source-itinerary-id',
      'new-slug-abc123',
    )
    expect(source).toEqual(original)
  })
})
