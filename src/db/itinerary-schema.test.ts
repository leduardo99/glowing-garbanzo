import { describe, expect, it } from 'vitest'
import * as schema from './schema'

describe('itinerary schema', () => {
  it('exports all domain tables', () => {
    for (const t of [
      'itinerary',
      'itineraryDay',
      'stop',
      'favorite',
      'rating',
      'comment',
      'itineraryMember',
    ] as const) {
      expect(schema[t]).toBeDefined()
    }
  })
})
