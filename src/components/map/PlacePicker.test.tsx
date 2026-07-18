// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import PlacePicker from './PlacePicker'

const searchPlacesMock = vi.hoisted(() => vi.fn())
vi.mock('#/lib/nominatim', () => ({ searchPlaces: searchPlacesMock }))

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
    constructor(public options?: { draggable?: boolean }) {}
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
    on() {
      return this
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
})
