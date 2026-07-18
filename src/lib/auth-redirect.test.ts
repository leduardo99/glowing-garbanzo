import { describe, expect, it } from 'vitest'

import { safeRedirectTarget } from './auth-redirect'

describe('safeRedirectTarget', () => {
  it('accepts a plain same-origin path', () => {
    expect(safeRedirectTarget('/ok/path')).toBe('/ok/path')
  })

  it('falls back to / for undefined', () => {
    expect(safeRedirectTarget(undefined)).toBe('/')
  })

  it('falls back to / for a protocol-relative URL (//evil.com)', () => {
    expect(safeRedirectTarget('//evil.com')).toBe('/')
  })

  it('falls back to / for an absolute URL (https://evil.com)', () => {
    expect(safeRedirectTarget('https://evil.com')).toBe('/')
  })

  it('falls back to / for a backslash open-redirect bypass (/\\evil.com)', () => {
    expect(safeRedirectTarget('/\\evil.com')).toBe('/')
  })

  it('falls back to / for a target containing a backslash anywhere (/path\\x)', () => {
    expect(safeRedirectTarget('/path\\x')).toBe('/')
  })

  it('falls back to / for an empty string', () => {
    expect(safeRedirectTarget('')).toBe('/')
  })
})
