/**
 * Search-a-place + draggable-pin picker for `StopForm`'s location section.
 * Owns the whole location-editing flow: debounced Nominatim search, a
 * results list, a mini MapLibre map that drops/moves a draggable marker on
 * selection or drag, and a "clear pin" action. `StopForm` lazy-loads this
 * module (`React.lazy`) only once the author opens the location section —
 * see that file — so `maplibre-gl` never loads for authors who only edit
 * text fields. Default export for the same `React.lazy` reason as
 * `ItineraryMap`.
 *
 * Degrades gracefully per the design doc's Errors section ("Nominatim
 * unavailable -> the editor keeps working; the pin is simply left unset"):
 * `searchPlaces` never throws, a failed/empty search just renders the
 * "no results" message, and nothing here ever blocks saving the stop —
 * lat/lng/placeLabel simply stay whatever they already were.
 */
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { XIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { searchPlaces } from '#/lib/nominatim'
import type { NominatimPlace } from '#/lib/nominatim'
import { m } from '#/paraglide/messages'

const DEBOUNCE_MS = 400
const DEFAULT_CENTER: [number, number] = [0, 20]

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

export interface PlacePickerLocation {
  lat: number | null
  lng: number | null
  placeLabel?: string
}

export default function PlacePicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null
  lng: number | null
  onChange: (next: PlacePickerLocation) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Latest onChange as a ref so the marker's `dragend` listener (attached
  // once, in the map-init effect) always calls the current callback without
  // needing to be re-attached every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(trimmed, controller.signal)
        .then((found) => {
          // An aborted request still resolves (to `[]`, per `searchPlaces`'s
          // never-throws contract) — if we applied that here regardless, a
          // slow, now-stale response could clobber the results/spinner state
          // of whatever newer query is currently in flight. Only the most
          // recent request (the one whose controller is still un-aborted)
          // gets to touch state.
          if (controller.signal.aborted) {
            return
          }
          setResults(found)
        })
        .finally(() => {
          if (controller.signal.aborted) {
            return
          }
          setIsSearching(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  const [mapFailed, setMapFailed] = useState(false)

  // Initialize the mini map once. If MapLibre can't initialize (e.g. WebGL
  // unavailable — see the note on `ItineraryMap`), the search box and
  // results list must keep working regardless: selecting a result still
  // calls `onChange` with real coordinates below, it just won't have a
  // visual pin to show or drag.
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const initialCenter: [number, number] =
      lat !== null && lng !== null ? [lng, lat] : DEFAULT_CENTER

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container,
        style: OSM_STYLE,
        center: initialCenter,
        zoom: lat !== null && lng !== null ? 13 : 1,
        attributionControl: { compact: true },
      })
    } catch (error) {
      console.error('PlacePicker: failed to initialize maplibre-gl', error)
      setMapFailed(true)
      return
    }
    mapRef.current = map

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // Intentionally initialized once — `lat`/`lng` changes afterward are
    // handled by the marker-sync effect below, not by re-creating the map.
  }, [])

  // Keep the marker in sync with lat/lng (selection, drag, or clear).
  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (lat === null || lng === null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (!markerRef.current) {
      const marker = new maplibregl.Marker({ draggable: true }).setLngLat([lng, lat]).addTo(map)
      marker.on('dragend', () => {
        const position = marker.getLngLat()
        onChangeRef.current({ lat: position.lat, lng: position.lng })
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLngLat([lng, lat])
    }

    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), duration: 500 })
  }, [lat, lng])

  function selectResult(result: NominatimPlace) {
    onChange({ lat: result.lat, lng: result.lng, placeLabel: result.label })
    setQuery('')
    setResults([])
  }

  const hasPin = lat !== null && lng !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={m.map_search_place()}
          aria-label={m.map_search_place()}
        />
        {hasPin ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ lat: null, lng: null })}
          >
            <XIcon data-icon="inline-start" />
            {m.map_clear_pin()}
          </Button>
        ) : null}
      </div>

      {!isSearching && query.trim() && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.map_no_results()}</p>
      ) : null}

      {results.length > 0 ? (
        <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-md border p-1">
          {results.map((result, index) => (
            <li key={`${result.lat}-${result.lng}-${index}`}>
              <button
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => selectResult(result)}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mapFailed ? null : (
        <p className="text-xs text-muted-foreground">{m.map_drag_hint()}</p>
      )}
      <div
        ref={containerRef}
        className={
          mapFailed ? 'hidden' : 'h-48 w-full overflow-hidden rounded-lg border'
        }
      />
    </div>
  )
}
