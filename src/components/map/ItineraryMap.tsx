/**
 * Read-only MapLibre view of an itinerary's stops: one marker per stop that
 * has coordinates, a popup with the stop's name and day label, and the
 * camera fit to bounds on load. Pure presentation — the caller (see
 * `src/routes/itineraries.$slug.tsx`) decides *whether* to render this at
 * all (no stop with coordinates -> don't mount it) and lazy-loads it via
 * `React.lazy`, since `maplibre-gl` is sizeable and most itineraries are
 * viewed far more often than they're mapped. That's also why this is the
 * module's default export: `React.lazy(() => import(...))` requires one.
 *
 * Uses the OSM raster tile style inline (no API key, no vector style
 * server) per the design doc's Media/Map decisions. Tile fetch failures
 * (offline, tile server down) degrade visually — MapLibre just shows blank/
 * grey tiles — never a crash. `maplibregl.Map`'s *constructor* can also
 * throw synchronously (e.g. WebGL unavailable — locked-down browser,
 * certain headless/sandboxed environments), which would otherwise take the
 * whole view down with it (an uncaught error in a `useEffect` propagates to
 * the nearest error boundary); that's caught below and just skips
 * rendering the map instead.
 */
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { m } from '#/paraglide/messages'

export interface ItineraryMapStop {
  id: string
  name: string
  lat: number
  lng: number
  dayNumber: number
}

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

export default function ItineraryMap({ stops }: { stops: ItineraryMapStop[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container || stops.length === 0) {
      return
    }

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container,
        style: OSM_STYLE,
        center: [stops[0].lng, stops[0].lat],
        zoom: 12,
        attributionControl: { compact: true },
      })
    } catch (error) {
      console.error('ItineraryMap: failed to initialize maplibre-gl', error)
      setFailed(true)
      return
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    const markers: maplibregl.Marker[] = []
    const bounds = new maplibregl.LngLatBounds()

    for (const stop of stops) {
      const popup = new maplibregl.Popup({ offset: 16 }).setText(
        `${m.view_day_label({ number: stop.dayNumber })} · ${stop.name}`,
      )
      const marker = new maplibregl.Marker()
        .setLngLat([stop.lng, stop.lat])
        .setPopup(popup)
        .addTo(map)
      markers.push(marker)
      bounds.extend([stop.lng, stop.lat])
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
    }

    return () => {
      for (const marker of markers) {
        marker.remove()
      }
      map.remove()
    }
    // Stops are recomputed as a fresh array on every render of the parent
    // (see `collectMapStops` in the route); re-initializing the map only
    // when the actual coordinate set changes avoids that from tearing the
    // map down on every unrelated re-render.
  }, [JSON.stringify(stops)])

  if (stops.length === 0 || failed) {
    return null
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={m.view_map_label()}
      className="h-80 w-full overflow-hidden rounded-lg border"
    />
  )
}
