import { describe, expect, it } from 'vitest'

import { buildAiItinerarySchema, buildDraftRows, buildGenerationPrompt } from './ai-draft'
import type { AiItineraryDraft } from './ai-draft'

const validDraft: AiItineraryDraft = {
  title: 'Weekend in Lisbon',
  summary: 'Two days of miradouros and pastéis.',
  tags: ['food', 'walking'],
  days: [
    {
      title: 'Alfama',
      note: 'Wear comfortable shoes.',
      stops: [
        { name: 'Castelo de São Jorge', category: 'attraction', description: 'Views over the city.', costCents: 1500 },
        { name: 'Pastéis de Belém', category: 'food' },
      ],
    },
    {
      stops: [{ name: 'Tram 28', category: 'transport' }],
    },
  ],
}

describe('buildAiItinerarySchema', () => {
  it('accepts a draft with exactly the requested day count', () => {
    expect(buildAiItinerarySchema(2).safeParse(validDraft).success).toBe(true)
  })

  it('rejects a draft whose day count differs from the requested one', () => {
    expect(buildAiItinerarySchema(3).safeParse(validDraft).success).toBe(false)
    expect(buildAiItinerarySchema(1).safeParse(validDraft).success).toBe(false)
  })

  it('rejects unknown stop categories and dayless drafts', () => {
    const badCategory = {
      ...validDraft,
      days: [{ stops: [{ name: 'X', category: 'nightlife' }] }, validDraft.days[1]],
    }
    expect(buildAiItinerarySchema(2).safeParse(badCategory).success).toBe(false)
    expect(buildAiItinerarySchema(2).safeParse({ ...validDraft, days: [] }).success).toBe(false)
  })
})

describe('buildGenerationPrompt', () => {
  it('pins the day count, destination, and content language', () => {
    const prompt = buildGenerationPrompt({
      destination: 'Salvador, Brazil',
      dayCount: 4,
      styles: [],
      locale: 'pt-BR',
    })
    expect(prompt).toContain('4-day travel itinerary for Salvador, Brazil')
    expect(prompt).toContain('exactly 4 days')
    expect(prompt).toContain('Brazilian Portuguese')
  })

  it('includes styles and trimmed preferences only when given', () => {
    const bare = buildGenerationPrompt({
      destination: 'Kyoto',
      dayCount: 2,
      styles: [],
      preferences: '   ',
      locale: 'en',
    })
    expect(bare).not.toContain('Trip style')
    expect(bare).not.toContain('Traveler preferences')

    const full = buildGenerationPrompt({
      destination: 'Kyoto',
      dayCount: 2,
      styles: ['food', 'culture'],
      preferences: '  no long hikes  ',
      locale: 'en',
    })
    expect(full).toContain('Trip style: food, culture.')
    expect(full).toContain('Traveler preferences: no long hikes')
  })

  it('falls back to the raw locale for unmapped locales', () => {
    const prompt = buildGenerationPrompt({
      destination: 'Paris',
      dayCount: 1,
      styles: [],
      locale: 'fr',
    })
    expect(prompt).toContain('in fr')
  })
})

describe('buildDraftRows', () => {
  it('maps the draft to insert rows with sequential day numbers and stop positions', () => {
    const rows = buildDraftRows(validDraft, {
      ownerId: 'user-1',
      destination: 'Lisbon',
      slug: 'weekend-in-lisbon-abc123',
    })

    expect(rows.itinerary).toEqual({
      authorId: 'user-1',
      title: 'Weekend in Lisbon',
      summary: 'Two days of miradouros and pastéis.',
      destination: 'Lisbon',
      tags: ['food', 'walking'],
      slug: 'weekend-in-lisbon-abc123',
      status: 'draft',
    })
    expect(rows.days.map((d) => d.dayNumber)).toEqual([1, 2])
    expect(rows.days[0].stops.map((s) => s.position)).toEqual([1, 2])
    expect(rows.days[1].stops.map((s) => s.position)).toEqual([1])
  })

  it('normalizes absent optional fields to null', () => {
    const rows = buildDraftRows(validDraft, {
      ownerId: 'user-1',
      destination: 'Lisbon',
      slug: 'slug-x',
    })

    expect(rows.days[1].title).toBeNull()
    expect(rows.days[1].note).toBeNull()
    expect(rows.days[0].stops[1]).toEqual({
      position: 2,
      name: 'Pastéis de Belém',
      category: 'food',
      description: null,
      startTime: null,
      costCents: null,
    })
  })
})
