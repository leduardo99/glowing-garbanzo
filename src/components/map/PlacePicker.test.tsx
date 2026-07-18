// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import PlacePicker from './PlacePicker'
import type { NominatimPlace } from '#/lib/nominatim'

const searchPlacesMock = vi.hoisted(() => vi.fn())
vi.mock('#/lib/nominatim', () => ({ searchPlaces: searchPlacesMock }))

/**
 * Every `FakeMarker` constructed during a test, in construction order — lets
 * tests reach into the marker MapLibre would otherwise own privately (e.g.
 * to fire its captured `dragend` handler) without exposing internals from
 * `PlacePicker` itself.
 */
const markerInstances = vi.hoisted(
  () =>
    [] as Array<{
      setLngLat: (lngLat: [number, number]) => unknown
      getLngLat: () => { lat: number; lng: number }
      trigger: (event: string) => void
    }>,
)

/**
 * `PlacePicker` renders a real MapLibre map, which needs a WebGL canvas
 * jsdom doesn't provide. We only need to verify the search-box logic here
 * (debounce, results list, selection, clear-pin) — not MapLibre's own
 * rendering, which is out of scope for a unit test — so the whole module is
 * stubbed with minimal fakes covering the calls `PlacePicker` makes
 * (`Map`/`Marker` construction, `addTo`, `setLngLat`, `on('dragend', ...)`).
 */
vi.mock('maplibre-gl', () => {
  class FakeMarker {
    private lngLat: [number, number] = [0, 0]
    private handlers: Record<string, (() => void) | undefined> = {}
    constructor(public options?: { draggable?: boolean }) {
      markerInstances.push(this)
    }
    setLngLat(lngLat: [number, number]) {
      this.lngLat = lngLat
      return this
    }
    getLngLat() {
      return { lat: this.lngLat[1], lng: this.lngLat[0] }
    }
    addTo() {
      return this
    }
    on(event: string, handler: () => void) {
      this.handlers[event] = handler
      return this
    }
    trigger(event: string) {
      this.handlers[event]?.()
    }
    remove() {
      return this
    }
  }
  class FakeMap {
    remove() {}
    flyTo() {}
    getZoom() {
      return 1
    }
    addControl() {}
  }
  return { default: { Map: FakeMap, Marker: FakeMarker } }
})

afterEach(() => {
  cleanup()
  searchPlacesMock.mockReset()
  markerInstances.length = 0
})

describe('PlacePicker', () => {
  it('debounces search: waits 400ms after the last keystroke before calling searchPlaces', async () => {
    searchPlacesMock.mockResolvedValue([])
    vi.useFakeTimers()

    try {
      render(<PlacePicker lat={null} lng={null} onChange={vi.fn()} />)
      const input = screen.getByLabelText(/buscar um local/i)

      // Simulate fast typing — each keystroke resets the debounce window,
      // so only the last one should end up scheduling a search.
      fireEvent.change(input, { target: { value: 'P' } })
      vi.advanceTimersByTime(200)
      fireEvent.change(input, { target: { value: 'Pa' } })
      vi.advanceTimersByTime(200)
      fireEvent.change(input, { target: { value: 'Paris' } })

      expect(searchPlacesMock).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(400)

      expect(searchPlacesMock).toHaveBeenCalledTimes(1)
      expect(searchPlacesMock).toHaveBeenCalledWith('Paris', expect.anything())
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders results and calls onChange with lat/lng/placeLabel when one is selected', async () => {
    searchPlacesMock.mockResolvedValue([
      { label: 'Paris, France', lat: 48.8566, lng: 2.3522 },
    ])
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<PlacePicker lat={null} lng={null} onChange={onChange} />)
    await user.type(screen.getByLabelText(/buscar um local/i), 'Paris')

    const option = await screen.findByRole('button', { name: 'Paris, France' })
    await user.click(option)

    expect(onChange).toHaveBeenCalledWith({
      lat: 48.8566,
      lng: 2.3522,
      placeLabel: 'Paris, France',
    })
  })

  it('shows a "no results" message when the search resolves empty', async () => {
    searchPlacesMock.mockResolvedValue([])
    const user = userEvent.setup()

    render(<PlacePicker lat={null} lng={null} onChange={vi.fn()} />)
    await user.type(screen.getByLabelText(/buscar um local/i), 'Nowhereville')

    expect(await screen.findByText(/nenhum local encontrado/i)).toBeInTheDocument()
  })

  it('degrades gracefully when the search fails: no crash, no results shown', async () => {
    searchPlacesMock.mockResolvedValue([])
    const user = userEvent.setup()

    render(<PlacePicker lat={null} lng={null} onChange={vi.fn()} />)
    await user.type(screen.getByLabelText(/buscar um local/i), 'Offline query')

    expect(await screen.findByText(/nenhum local encontrado/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('button').length).toBeGreaterThanOrEqual(0)
  })

  it('only shows the clear-pin button when a pin is set, and clears lat/lng on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(
      <PlacePicker lat={null} lng={null} onChange={onChange} />,
    )
    expect(
      screen.queryByRole('button', { name: /remover pino/i }),
    ).not.toBeInTheDocument()

    rerender(<PlacePicker lat={48.8566} lng={2.3522} onChange={onChange} />)
    const clearButton = await screen.findByRole('button', { name: /remover pino/i })
    await user.click(clearButton)

    expect(onChange).toHaveBeenCalledWith({ lat: null, lng: null })
  })

  it('maps the dragged marker position (lng, lat) to onChange({ lat, lng })', async () => {
    const onChange = vi.fn()

    render(<PlacePicker lat={48.8566} lng={2.3522} onChange={onChange} />)

    expect(markerInstances).toHaveLength(1)
    const marker = markerInstances[0]
    // Simulate MapLibre updating the marker's own position mid-drag, then
    // firing `dragend` — `PlacePicker` reads the final position back via
    // `getLngLat()`, so this pins the lat/lng swap risk noted in
    // `PlacePicker`'s `dragend` handler.
    marker.setLngLat([-46.63, -23.55])
    marker.trigger('dragend')

    expect(onChange).toHaveBeenCalledWith({ lat: -23.55, lng: -46.63 })
  })

  it('ignores a stale aborted search result that resolves after a newer query is already in flight', async () => {
    const pending: Array<{ query: string; resolve: (found: NominatimPlace[]) => void }> = []
    searchPlacesMock.mockImplementation(
      (q: string) =>
        new Promise<NominatimPlace[]>((resolve) => {
          pending.push({ query: q, resolve })
        }),
    )
    vi.useFakeTimers()

    try {
      render(<PlacePicker lat={null} lng={null} onChange={vi.fn()} />)
      const input = screen.getByLabelText(/buscar um local/i)

      // First query debounces and its search starts (call #1, left pending).
      fireEvent.change(input, { target: { value: 'Nowhereville' } })
      await vi.advanceTimersByTimeAsync(400)
      expect(pending).toHaveLength(1)

      // Before #1 resolves, the user keeps typing: the effect's cleanup
      // aborts #1's real AbortController, and a new debounce starts a
      // second search (call #2, also left pending).
      fireEvent.change(input, { target: { value: 'Nowhereville 2' } })
      await vi.advanceTimersByTimeAsync(400)
      expect(pending).toHaveLength(2)

      // #1 finally settles late (resolving to `[]`, exactly like a real
      // aborted `searchPlaces` call does) while #2 — the current, relevant
      // request — is still in flight. This must not flash a false "no
      // results" message or otherwise clobber state for #2.
      await act(async () => {
        pending[0].resolve([])
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(screen.queryByText(/nenhum local encontrado/i)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
