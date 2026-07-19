import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './relative-time'

describe('formatRelativeTime', () => {
  it('is deterministic given an explicit reference timestamp', () => {
    const now = Date.parse('2026-07-19T12:00:00Z')
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoHoursAgo, 'en', now)).toBe('2 hours ago')
    expect(formatRelativeTime(twoHoursAgo, 'pt-BR', now)).toBe('há 2 horas')
  })

  it('defaults the reference to the current time', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinutesAgo, 'en')).toBe('5 minutes ago')
  })
})
