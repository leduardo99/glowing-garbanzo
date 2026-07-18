import { describe, expect, it } from 'vitest'

import { makeSlug } from './slug'

describe('makeSlug', () => {
  it('lowercases, strips accents, and replaces non-alphanumerics with dashes', () => {
    const slug = makeSlug('7 dias na Chapada!', () => 'xxxxxx')
    expect(slug).toBe('7-dias-na-chapada-xxxxxx')
  })

  it('strips a wider range of accented characters', () => {
    const slug = makeSlug('Férias em São Paulo — Ação!', () => 'abcdef')
    expect(slug).toBe('ferias-em-sao-paulo-acao-abcdef')
  })

  it('collapses repeated separators and trims leading/trailing dashes before the suffix', () => {
    const slug = makeSlug('  --Multiple   Spaces--  ', () => '123456')
    expect(slug).toBe('multiple-spaces-123456')
  })

  it('handles an empty title by falling back to just the suffix', () => {
    const slug = makeSlug('', () => 'abc123')
    expect(slug).toBe('abc123')
  })

  it('handles a title made entirely of non-alphanumeric characters', () => {
    const slug = makeSlug('!!!???', () => 'abc123')
    expect(slug).toBe('abc123')
  })

  it('uses a default random suffix generator producing a 6-character string when none is supplied', () => {
    const slug = makeSlug('Trip to Rio')
    const [, suffix] = slug.match(/^trip-to-rio-(.+)$/) ?? []
    expect(suffix).toBeDefined()
    expect(suffix).toHaveLength(6)
  })

  it('produces different default suffixes across calls', () => {
    const a = makeSlug('Trip to Rio')
    const b = makeSlug('Trip to Rio')
    expect(a).not.toBe(b)
  })
})
