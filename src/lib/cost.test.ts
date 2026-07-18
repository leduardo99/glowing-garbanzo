import { describe, expect, it } from 'vitest'

import { formatCentsToCostInput, parseCostToCents } from './cost'

describe('parseCostToCents', () => {
  it('parses a comma-decimal value', () => {
    expect(parseCostToCents('25,50')).toBe(2550)
  })

  it('parses a dot-decimal value', () => {
    expect(parseCostToCents('25.50')).toBe(2550)
  })

  it('parses an integer value with no fraction', () => {
    expect(parseCostToCents('30')).toBe(3000)
  })

  it('parses a single fraction digit', () => {
    expect(parseCostToCents('9,5')).toBe(950)
  })

  it('rounds a value to the nearest cent', () => {
    expect(parseCostToCents('10.005')).toBe(null) // 3 fraction digits: unsupported shape
  })

  it('returns null for blank input', () => {
    expect(parseCostToCents('')).toBe(null)
    expect(parseCostToCents('   ')).toBe(null)
  })

  it('returns null for non-numeric input', () => {
    expect(parseCostToCents('abc')).toBe(null)
  })

  it('returns null for a negative value', () => {
    expect(parseCostToCents('-5')).toBe(null)
  })

  it('trims surrounding whitespace', () => {
    expect(parseCostToCents('  25,50  ')).toBe(2550)
  })
})

describe('formatCentsToCostInput', () => {
  it('formats cents back to a two-decimal string', () => {
    expect(formatCentsToCostInput(2550)).toBe('25.50')
  })

  it('formats zero', () => {
    expect(formatCentsToCostInput(0)).toBe('0.00')
  })

  it('returns an empty string for null', () => {
    expect(formatCentsToCostInput(null)).toBe('')
  })

  it('returns an empty string for undefined', () => {
    expect(formatCentsToCostInput(undefined)).toBe('')
  })
})
