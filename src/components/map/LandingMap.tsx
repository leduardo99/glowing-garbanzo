/**
 * The landing page's hero: a live MapLibre map with the community's
 * published routes drawn on it — the drawn-route signature (DESIGN.md §5)
 * at its largest register. Amber dashed lines connect each itinerary's
 * geocoded stops; endpoints get small mata discs. Clicking a route opens
 * its itinerary.
 *
 * Deliberately calm for a scrolling page: scroll-zoom is disabled (the
 * page keeps scrolling; +/- controls and drag still work), and the camera
 * simply fits all routes once. Same OSM raster style and fixed light-tuned
 * route ink as `ItineraryMap` (tiles are always light regardless of app
 * theme).
 *
 * Lazy-loaded by the landing route. The parent stacks this over a
 * RouteSketch panel: when the map renders it covers the sketch, and when
 * it can't (no routes, no WebGL — this component returns `null`) the
 * sketch simply stays visible. No failure callback needed.
 */
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { LandingMapRoute } from '#/server/landing'

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

export default function LandingMap({
  routes,
  onOpenRoute,
  className,
}: {
  routes: LandingMapRoute[]
  /** Called with the itinerary slug when a route is clicked. */
  onOpenRoute: (slug: string) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  // The router navigate callback changes identity between renders; a ref
  // keeps the map's click handlers stable without re-initializing the map.
  const openRouteRef = useRef(onOpenRoute)
  openRouteRef.current = onOpenRoute

  useEffect(() => {
    const container = containerRef.current
    if (!container || routes.length === 0) {
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
        scrollZoom: false,
      })
    } catch (error) {
      console.error('LandingMap: failed to initialize maplibre-gl', error)
      setFailed(true)
      return
    }
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    )

    const bounds = new maplibregl.LngLatBounds()
    for (const route of routes) {
      for (const p of route.points) {
        bounds.extend([p.lng, p.lat])
      }
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 64, maxZoom: 11, duration: 0 })
    }

    // `style.load`, not `load`: `load` additionally waits for initial
    // tile fetches, which can stall forever offline or behind a blocking
    // proxy — the drawn route must not depend on the basemap's luck.
    map.on('style.load', () => {
      map.addSource('community-routes', {
        type: 'geojson',
        data: {
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
      })
      map.addSource('community-stops', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routes.flatMap((route) =>
            route.points.map((p) => ({
              type: 'Feature' as const,
              properties: { slug: route.slug, title: route.title },
              geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
            })),
          ),
        },
      })
      // Wider invisible line first: a comfortable hit area for hover/click
      // without fattening the visible stroke.
      map.addLayer({
        id: 'routes-hit',
        type: 'line',
        source: 'community-routes',
        paint: { 'line-color': ROUTE_AMBER, 'line-width': 16, 'line-opacity': 0 },
      })
      map.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'community-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ROUTE_AMBER,
          'line-width': 2.5,
          'line-opacity': 0.9,
          'line-dasharray': [1.6, 1.4],
        },
      })
      map.addLayer({
        id: 'routes-stops',
        type: 'circle',
        source: 'community-stops',
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
        const title = feature?.properties.title as string | undefined
        if (title) {
          popup.setLngLat(event.lngLat).setText(title).addTo(map)
        }
      })
      map.on('mouseleave', 'routes-hit', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })
      map.on('click', 'routes-hit', (event) => {
        const slug = event.features?.[0]?.properties?.slug as string | undefined
        if (slug) {
          openRouteRef.current(slug)
        }
      })
    })

    return () => {
      map.remove()
    }
    // Route data is loader-provided and stable per page load; stringify
    // guards against referentially-new-but-identical arrays re-initializing
    // the map (same convention as ItineraryMap).
  }, [JSON.stringify(routes)])

  if (routes.length === 0 || failed) {
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
