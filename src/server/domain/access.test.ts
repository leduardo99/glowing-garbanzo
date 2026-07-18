import { describe, expect, it } from 'vitest'

import { canEdit, canRate, canRead } from './access'
import type { ItineraryAccessData } from './access'

const author = 'user-author'
const other = 'user-other'

function itinerary(
  overrides: Partial<ItineraryAccessData> = {},
): ItineraryAccessData {
  return {
    authorId: author,
    status: 'published',
    visibility: 'public',
    ...overrides,
  }
}

describe('canRead', () => {
  it('allows anonymous users to read a published public itinerary', () => {
    const it_ = itinerary({ status: 'published', visibility: 'public' })
    expect(canRead(it_, { userId: null, isMember: false })).toBe(true)
  })

  it('allows a member to read a published private itinerary', () => {
    const it_ = itinerary({ status: 'published', visibility: 'private' })
    expect(canRead(it_, { userId: other, isMember: true })).toBe(true)
  })

  it('denies a non-member reading a published private itinerary', () => {
    const it_ = itinerary({ status: 'published', visibility: 'private' })
    expect(canRead(it_, { userId: other, isMember: false })).toBe(false)
  })

  it('denies an anonymous user reading a published private itinerary', () => {
    const it_ = itinerary({ status: 'published', visibility: 'private' })
    expect(canRead(it_, { userId: null, isMember: false })).toBe(false)
  })

  it('allows the author to read their own draft', () => {
    const it_ = itinerary({ status: 'draft' })
    expect(canRead(it_, { userId: author, isMember: false })).toBe(true)
  })

  it('denies another logged-in user reading someone else draft', () => {
    const it_ = itinerary({ status: 'draft' })
    expect(canRead(it_, { userId: other, isMember: false })).toBe(false)
  })

  it('denies an anonymous user reading a draft', () => {
    const it_ = itinerary({ status: 'draft' })
    expect(canRead(it_, { userId: null, isMember: false })).toBe(false)
  })

  it('allows the author to read a published private itinerary even without membership', () => {
    const it_ = itinerary({ status: 'published', visibility: 'private' })
    expect(canRead(it_, { userId: author, isMember: false })).toBe(true)
  })
})

describe('canEdit', () => {
  it('allows the author to edit', () => {
    const it_ = itinerary({ status: 'draft' })
    expect(canEdit(it_, { userId: author, isMember: false })).toBe(true)
  })

  it('denies a member (non-author) from editing', () => {
    const it_ = itinerary({ status: 'published', visibility: 'private' })
    expect(canEdit(it_, { userId: other, isMember: true })).toBe(false)
  })

  it('denies an anonymous user from editing', () => {
    const it_ = itinerary({ status: 'published', visibility: 'public' })
    expect(canEdit(it_, { userId: null, isMember: false })).toBe(false)
  })
})

describe('canRate', () => {
  it('allows a logged-in user to rate a published public itinerary', () => {
    const it_ = itinerary({ status: 'published', visibility: 'public' })
    expect(canRate(it_, { userId: other, isMember: false })).toBe(true)
  })

  it('denies rating a published private itinerary even for a member', () => {
    const it_ = itinerary({ status: 'published', visibility: 'private' })
    expect(canRate(it_, { userId: other, isMember: true })).toBe(false)
  })

  it('denies an anonymous user from rating a published public itinerary', () => {
    const it_ = itinerary({ status: 'published', visibility: 'public' })
    expect(canRate(it_, { userId: null, isMember: false })).toBe(false)
  })

  it('denies rating a draft itinerary', () => {
    const it_ = itinerary({ status: 'draft', visibility: 'public' })
    expect(canRate(it_, { userId: author, isMember: false })).toBe(false)
  })
})
