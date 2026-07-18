import { describe, expect, it } from 'vitest'

import { applyRating } from './rating'

describe('applyRating', () => {
  it('handles a first rating on an itinerary with no prior ratings', () => {
    const result = applyRating({ ratingAvg: null, ratingCount: 0 }, { previousStars: null, newStars: 5 })
    expect(result).toEqual({ ratingAvg: 5, ratingCount: 1 })
  })

  it('grows the count and recomputes the average when a new user rates', () => {
    // existing: two ratings averaging 4.5 (sum 9), a third user rates 3
    const result = applyRating({ ratingAvg: 4.5, ratingCount: 2 }, { previousStars: null, newStars: 3 })
    expect(result.ratingCount).toBe(3)
    expect(result.ratingAvg).toBeCloseTo(4, 10)
  })

  it('keeps the count unchanged and adjusts the average when a user re-rates', () => {
    const result = applyRating({ ratingAvg: 5, ratingCount: 1 }, { previousStars: 5, newStars: 3 })
    expect(result).toEqual({ ratingAvg: 3, ratingCount: 1 })
  })

  it('preserves precision on a re-rating that does not divide evenly', () => {
    // sum was 12 across 3 ratings (avg 4); one user changes 3 -> 4, new sum 13
    const result = applyRating({ ratingAvg: 4, ratingCount: 3 }, { previousStars: 3, newStars: 4 })
    expect(result.ratingCount).toBe(3)
    expect(result.ratingAvg).toBeCloseTo(13 / 3, 10)
  })

  it('preserves precision on a new rating that does not divide evenly', () => {
    // sum was 9 across 2 ratings (avg 4.5), a third user rates 4 -> sum 13
    const result = applyRating({ ratingAvg: 4.5, ratingCount: 2 }, { previousStars: null, newStars: 4 })
    expect(result.ratingCount).toBe(3)
    expect(result.ratingAvg).toBeCloseTo(13 / 3, 10)
  })
})
