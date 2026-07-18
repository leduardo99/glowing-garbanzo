// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { ItineraryCard } from './ItineraryCard'
import type { ItineraryCard as ItineraryCardData } from '#/server/itineraries'

afterEach(() => {
  cleanup()
})

function makeItem(overrides: Partial<ItineraryCardData> = {}): ItineraryCardData {
  return {
    id: 'it_1',
    slug: 'chapada-diamantina-abc123',
    title: 'Chapada Diamantina',
    destination: 'Bahia, Brazil',
    summary: 'Waterfalls and canyons',
    tags: ['adventure', 'nature', 'budget', 'family'],
    coverImageUrl: null,
    ratingAvg: 4.5,
    ratingCount: 12,
    dayCount: 5,
    publishedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('ItineraryCard', () => {
  it('renders title, destination, day count, and rating from props', () => {
    render(<ItineraryCard item={makeItem()} />)

    expect(screen.getByText('Chapada Diamantina')).toBeInTheDocument()
    expect(screen.getByText('Bahia, Brazil')).toBeInTheDocument()
    expect(screen.getByText('5 dias')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('(12)')).toBeInTheDocument()
  })

  it('caps visible tags and renders them as badges', () => {
    render(<ItineraryCard item={makeItem()} />)

    expect(screen.getByText('adventure')).toBeInTheDocument()
    expect(screen.getByText('nature')).toBeInTheDocument()
    expect(screen.getByText('budget')).toBeInTheDocument()
    expect(screen.queryByText('family')).not.toBeInTheDocument()
  })

  it('shows an em dash placeholder when there is no rating yet', () => {
    render(<ItineraryCard item={makeItem({ ratingAvg: null, ratingCount: 0 })} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('(0)')).toBeInTheDocument()
  })

  it('renders without a destination or cover image', () => {
    render(<ItineraryCard item={makeItem({ destination: null, coverImageUrl: null })} />)

    expect(screen.getByText('Chapada Diamantina')).toBeInTheDocument()
    expect(screen.queryByText('Bahia, Brazil')).not.toBeInTheDocument()
  })
})
