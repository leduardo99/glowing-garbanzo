/**
 * Read-only MapLibre view of an itinerary's stops, carrying the app's
 * drawn-route signature (DESIGN.md §5 "The Drawn Route"): stops connect in
 * visit order with a dashed amber route line, and each stop is a numbered
 * mata-green disc matching the day timeline's numbering — map and list are
 * two views of the same journey. Pure presentation — the caller (see
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
 *
 * Colors are fixed light-theme hexes (not CSS vars): the OSM raster tiles
 * are always light, so the route ink must stay tuned to *them*, not to the
 * app's current theme. Popup/control chrome does follow the theme — see
 * styles.css's `.maplibregl-*` re-skin.
 */
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

export interface ItineraryMapStop {
  id: string
  name: string
  lat: number
  lng: number
  dayNumber: number
  /** 'HH:MM' display time, when the author set one. */
  startTime?: string | null
  /** Global 1-based stop number across the whole trip — matches the timeline's numbering. */
  sequence: number
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

/* Route ink, tuned to the always-light OSM tiles (see doc comment). */
const ROUTE_AMBER = '#b17000'
const MARKER_MATA = '#17552e'
const MARKER_CREAM = '#fcfaf6'

/** Numbered mata disc — the same visual as the timeline's stop markers. */
function createStopMarkerElement(sequence: number): HTMLDivElement {
  const el = document.createElement('div')
  el.textContent = String(sequence)
  el.style.cssText = [
    'width:26px',
    'height:26px',
    'border-radius:9999px',
    `background:${MARKER_MATA}`,
    `color:${MARKER_CREAM}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-family:Karla,ui-sans-serif,system-ui,sans-serif',
    'font-size:12px',
    'font-weight:600',
    'font-variant-numeric:tabular-nums',
    `border:2px solid ${MARKER_CREAM}`,
    'box-shadow:0 1px 4px rgba(11,21,16,0.35)',
    'cursor:pointer',
  ].join(';')
  return el
}

export default function ItineraryMap({
  stops,
  className,
}: {
  stops: ItineraryMapStop[]
  /** Overrides the container's sizing (default `h-80 w-full`) — the detail page stretches the desktop sticky column's map taller. */
  className?: string
}) {
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
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    )

    // The drawn route: a dashed amber line connecting stops in visit
    // order. Layers can only be added once the style has loaded.
    if (stops.length > 1) {
      // `style.load`, not `load`: `load` additionally waits for initial
    // tile fetches, which can stall forever offline or behind a blocking
    // proxy — the drawn route must not depend on the basemap's luck.
    map.on('style.load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: stops.map((stop) => [stop.lng, stop.lat]),
            },
          },
        })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ROUTE_AMBER,
            'line-width': 3,
            'line-opacity': 0.9,
            // Dash lengths are multiples of line-width — this reads as the
            // same hand-drawn dashed stroke RouteSketch uses.
            'line-dasharray': [1.6, 1.4],
          },
        })
      })
    }

    const markers: maplibregl.Marker[] = []
    const bounds = new maplibregl.LngLatBounds()

    for (const stop of stops) {
      const popup = new maplibregl.Popup({ offset: 18 }).setText(
        [
          m.view_day_label({ number: stop.dayNumber }),
          stop.startTime ?? null,
          stop.name,
        ]
          .filter(Boolean)
          .join(' · '),
      )
      const marker = new maplibregl.Marker({
        element: createStopMarkerElement(stop.sequence),
      })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(popup)
        .addTo(map)
      markers.push(marker)
      bounds.extend([stop.lng, stop.lat])
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 0 })
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
      className={cn(
        'h-80 w-full overflow-hidden rounded-lg shadow-resting',
        className,
      )}
    />
  )
}
