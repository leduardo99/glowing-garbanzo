import { afterEach, describe, expect, it, vi } from 'vitest'

import { searchPlaces } from './nominatim'

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: () => Promise.resolve(body),
  } as Response
}

/**
 * A fetch stub that mimics real `fetch` abort semantics: each call is
 * "deferred" (resolved manually via `calls[i].resolve`) and rejects with an
 * AbortError the moment its passed-in signal fires `abort` — exactly what a
 * real in-flight request does, letting us test `searchPlaces`'s
 * previous-request cancellation without relying on timing.
 */
function createDeferredFetch() {
  const calls: Array<{
    url: string
    signal?: AbortSignal | null
    resolve: (value: Response) => void
  }> = []

  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      calls.push({ url, signal: init?.signal, resolve })
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'))
      })
    })
  })

  return { fetchMock, calls }
}

describe('searchPlaces', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps display_name/lat/lon (strings) to label/lat/lng (numbers)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { display_name: 'Paris, France', lat: '48.8566', lon: '2.3522' },
        { display_name: 'Paris, Texas, USA', lat: '33.6609', lon: '-95.5555' },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchPlaces('paris')

    expect(results).toEqual([
      { label: 'Paris, France', lat: 48.8566, lng: 2.3522 },
      { label: 'Paris, Texas, USA', lat: 33.6609, lng: -95.5555 },
    ])
  })

  it('requests jsonv2 format with the query string, over HTTPS', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    await searchPlaces('Chapada Diamantina')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [calledUrl] = fetchMock.mock.calls[0] as [string]
    const url = new URL(calledUrl)
    expect(url.protocol).toBe('https:')
    expect(url.hostname).toBe('nominatim.openstreetmap.org')
    expect(url.pathname).toBe('/search')
    expect(url.searchParams.get('format')).toBe('jsonv2')
    expect(url.searchParams.get('q')).toBe('Chapada Diamantina')
  })

  it('returns [] without making a request for a blank query', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchPlaces('')).toEqual([])
    expect(await searchPlaces('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aborts the previous in-flight request when a new search starts before it resolves', async () => {
    const { fetchMock, calls } = createDeferredFetch()
    vi.stubGlobal('fetch', fetchMock)

    const first = searchPlaces('par')
    // Let the abort-triggering microtask queue (event listener registration
    // inside searchPlaces) settle before firing the second call.
    await Promise.resolve()
    const second = searchPlaces('paris')

    expect(calls).toHaveLength(2)
    expect(calls[0].signal?.aborted).toBe(true)

    calls[1].resolve(
      jsonResponse([{ display_name: 'Paris, France', lat: '48.8566', lon: '2.3522' }]),
    )

    await expect(first).resolves.toEqual([])
    await expect(second).resolves.toEqual([
      { label: 'Paris, France', lat: 48.8566, lng: 2.3522 },
    ])
  })

  it('resolves to [] when the caller-provided signal is already aborted', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()

    const results = await searchPlaces('paris', controller.signal)

    expect(results).toEqual([])
  })

  it('returns [] when the network request fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchPlaces('paris')).toEqual([])
  })

  it('returns [] for a non-OK HTTP response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([], { ok: false, status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchPlaces('paris')).toEqual([])
  })

  it('returns [] for an empty results array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchPlaces('a place nobody has heard of')).toEqual([])
  })

  it('skips malformed items (missing display_name or non-numeric lat/lon) instead of throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { display_name: 'Valid Place', lat: '1.5', lon: '2.5' },
        { lat: '1', lon: '2' },
        { display_name: 'Bad coords', lat: 'not-a-number', lon: '2' },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchPlaces('x')).toEqual([{ label: 'Valid Place', lat: 1.5, lng: 2.5 }])
  })
})
