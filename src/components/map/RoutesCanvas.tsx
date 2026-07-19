/**
 * Shared many-routes MapLibre canvas — the drawn-route signature at
 * catalog scale. Draws a set of route polylines (dashed amber, mata stop
 * dots), fits the camera to them, and supports the explore workspace's
 * interactions: hovering a route reports its slug out (`onHoverRoute`),
 * and a `highlightSlug` from outside (a hovered result card) thickens
 * that route on the canvas — list and map are two views of one result
 * set.
 *
 * Unlike the first LandingMap implementation, filter changes do NOT tear
 * the map down: once the style is loaded, new routes update the existing
 * geojson sources in place and the camera re-fits — panning/zoom state
 * machinery, tiles, and the WebGL context all survive.
 *
 * Same environment constraints as ItineraryMap: OSM raster tiles (always
 * light — route ink uses fixed light-tuned hexes), `style.load` instead of
 * `load` (tile fetches can stall behind a blocking proxy), constructor
 * failures (no WebGL) just render nothing and report via `onFail`.
 */
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'

import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

export interface CanvasRoute {
  slug: string
  title: string
  points: Array<{ lat: number; lng: number }>
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

/* Route ink, tuned to the always-light OSM tiles (see ItineraryMap). */
const ROUTE_AMBER = '#b17000'
const STOP_MATA = '#17552e'
const STOP_CREAM = '#fcfaf6'

function toGeojson(routes: CanvasRoute[]): {
  lines: FeatureCollection
  stops: FeatureCollection
} {
  return {
    lines: {
      type: 'FeatureCollection',
      features: routes.map((route) => ({
        type: 'Feature',
        properties: { slug: route.slug, title: route.title },
        geometry: {
          type: 'LineString',
          coordinates: route.points.map((p) => [p.lng, p.lat]),
        },
      })),
    },
    stops: {
      type: 'FeatureCollection',
      features: routes.flatMap((route) =>
        route.points.map((p) => ({
          type: 'Feature' as const,
          properties: { slug: route.slug },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
      ),
    },
  }
}

function boundsOf(routes: CanvasRoute[]): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds()
  for (const route of routes) {
    for (const p of route.points) {
      bounds.extend([p.lng, p.lat])
    }
  }
  return bounds
}

export function RoutesCanvas({
  routes,
  onOpenRoute,
  onHoverRoute,
  highlightSlug = null,
  scrollZoom = true,
  className,
}: {
  routes: CanvasRoute[]
  /** Called with the itinerary slug when a route is clicked. */
  onOpenRoute: (slug: string) => void
  /** Reports the hovered route's slug (or null) so the caller can mirror it in a list. */
  onHoverRoute?: (slug: string | null) => void
  /** A slug to emphasize on the canvas (e.g. the list's hovered card). */
  highlightSlug?: string | null
  /** The landing disables scroll-zoom so the page keeps scrolling. */
  scrollZoom?: boolean
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const styleReadyRef = useRef(false)
  const [failed, setFailed] = useState(false)
  // Callback identities change between renders; refs keep the map's
  // handlers stable without re-initializing anything.
  const openRouteRef = useRef(onOpenRoute)
  openRouteRef.current = onOpenRoute
  const hoverRouteRef = useRef(onHoverRoute)
  hoverRouteRef.current = onHoverRoute
  const routesRef = useRef(routes)
  routesRef.current = routes

  // One-time map construction (routes flow in via the update effect below).
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container,
        style: OSM_STYLE,
        center: [-47, -15],
        zoom: 3,
        attributionControl: { compact: true },
        scrollZoom,
      })
    } catch (error) {
      console.error('RoutesCanvas: failed to initialize maplibre-gl', error)
      setFailed(true)
      return
    }
    mapRef.current = map
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    )

    const initialBounds = boundsOf(routesRef.current)
    if (!initialBounds.isEmpty()) {
      map.fitBounds(initialBounds, { padding: 64, maxZoom: 11, duration: 0 })
    }

    // `style.load`, not `load`: `load` additionally waits for initial
    // tile fetches, which can stall forever offline or behind a blocking
    // proxy — the drawn routes must not depend on the basemap's luck.
    map.on('style.load', () => {
      const { lines, stops } = toGeojson(routesRef.current)
      map.addSource('routes-lines', { type: 'geojson', data: lines })
      map.addSource('routes-stops', { type: 'geojson', data: stops })
      // Wider invisible line first: a comfortable hit area for hover/click
      // without fattening the visible stroke.
      map.addLayer({
        id: 'routes-hit',
        type: 'line',
        source: 'routes-lines',
        paint: { 'line-color': ROUTE_AMBER, 'line-width': 16, 'line-opacity': 0 },
      })
      map.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ROUTE_AMBER,
          'line-width': 2.5,
          'line-opacity': 0.85,
          'line-dasharray': [1.6, 1.4],
        },
      })
      // The emphasized route: same ink, heavier stroke, filtered to one
      // slug at a time (empty filter matches nothing).
      map.addLayer({
        id: 'routes-line-active',
        type: 'line',
        source: 'routes-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        filter: ['==', ['get', 'slug'], ''],
        paint: {
          'line-color': ROUTE_AMBER,
          'line-width': 4.5,
          'line-opacity': 1,
          'line-dasharray': [1.6, 1.4],
        },
      })
      map.addLayer({
        id: 'routes-stops',
        type: 'circle',
        source: 'routes-stops',
        paint: {
          'circle-radius': 4.5,
          'circle-color': STOP_MATA,
          'circle-stroke-color': STOP_CREAM,
          'circle-stroke-width': 1.5,
        },
      })

      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
        closeOnMove: true,
      })

      map.on('mouseenter', 'routes-hit', (event) => {
        map.getCanvas().style.cursor = 'pointer'
        const feature = event.features?.[0]
        const slug = feature?.properties.slug as string | undefined
        const title = feature?.properties.title as string | undefined
        if (title) {
          popup.setLngLat(event.lngLat).setText(title).addTo(map)
        }
        if (slug) {
          hoverRouteRef.current?.(slug)
        }
      })
      map.on('mouseleave', 'routes-hit', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
        hoverRouteRef.current?.(null)
      })
      map.on('click', 'routes-hit', (event) => {
        const slug = event.features?.[0]?.properties?.slug as string | undefined
        if (slug) {
          openRouteRef.current(slug)
        }
      })

      styleReadyRef.current = true
    })

    return () => {
      styleReadyRef.current = false
      mapRef.current = null
      map.remove()
    }
    // scrollZoom is a mount-time choice; callers never toggle it live.
  }, [])

  // Filter changes: update the sources in place and re-fit the camera —
  // no teardown. Stringify guards referentially-new-but-identical arrays.
  const routesKey = JSON.stringify(routes)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) {
      return
    }
    const { lines, stops } = toGeojson(routes)
    const lineSource = map.getSource<maplibregl.GeoJSONSource>('routes-lines')
    const stopSource = map.getSource<maplibregl.GeoJSONSource>('routes-stops')
    lineSource?.setData(lines)
    stopSource?.setData(stops)
    const bounds = boundsOf(routes)
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 64, maxZoom: 11, duration: 450 })
    }
  }, [routesKey])

  // External highlight (hovered result card) → emphasized stroke.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current || !map.getLayer('routes-line-active')) {
      return
    }
    map.setFilter('routes-line-active', [
      '==',
      ['get', 'slug'],
      highlightSlug ?? '',
    ])
  }, [highlightSlug])

  if (failed) {
    return null
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={m.landing_map_label()}
      className={cn('h-full w-full bg-mata-soft', className)}
    />
  )
}
