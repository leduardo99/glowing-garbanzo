/**
 * The landing page's hero map — a thin wrapper over the shared
 * `RoutesCanvas` (see RoutesCanvas.tsx for the drawing/interaction
 * details). Landing-specific choices live here: scroll-zoom stays off so
 * the page keeps scrolling, and an empty route set renders nothing at all
 * so the RouteSketch panel stacked underneath stays visible (the hero's
 * automatic fallback — no failure callback needed).
 *
 * Default export because the landing lazy-loads it
 * (`React.lazy(() => import(...))` requires one).
 */
import { RoutesCanvas } from '#/components/map/RoutesCanvas'
import type { CanvasRoute } from '#/components/map/RoutesCanvas'

export default function LandingMap({
  routes,
  onOpenRoute,
  className,
}: {
  routes: CanvasRoute[]
  onOpenRoute: (slug: string) => void
  className?: string
}) {
  if (routes.length === 0) {
    return null
  }
  return (
    <RoutesCanvas
      routes={routes}
      onOpenRoute={onOpenRoute}
      scrollZoom={false}
      className={className}
    />
  )
}
