import { Link } from '@tanstack/react-router'
import { LoaderCircleIcon } from 'lucide-react'

import { RouteSketch } from '#/components/RouteSketch'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

/**
 * `router.tsx`'s `defaultPendingComponent` — shown while a route (or any
 * of its loaders) is still pending, for routes that don't define their
 * own `pendingComponent`. A quiet branded spinner, not a layout shift:
 * centered in the available space, `role="status"` with an sr-only label
 * so screen readers announce the wait instead of silence.
 */
export function RoutePendingFallback() {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] items-center justify-center py-16"
    >
      <LoaderCircleIcon
        className="size-8 animate-spin text-mata"
        aria-hidden="true"
      />
      <span className="sr-only">{m.app_loading()}</span>
    </div>
  )
}

/**
 * `router.tsx`'s `defaultErrorComponent` — the app's error boundary.
 * Offers a retry (`reset`, re-runs the failed route/loaders) and an
 * escape hatch back to `/`. The drawn-route sketch stands in as branded
 * empty-state art (DESIGN.md: never a gray void).
 */
export function RouteErrorFallback({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <RouteSketch seed="error" stops={3} className="h-16 w-40 opacity-70" />
      <h1 className="font-display text-2xl text-ink">{m.app_error_title()}</h1>
      <p className="max-w-[45ch] text-sm text-ink-soft">
        {m.app_error_description()}
      </p>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => reset()}>
          {m.app_error_retry()}
        </Button>
        <Button asChild>
          <Link to="/">{m.app_error_home()}</Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * `router.tsx`'s `defaultNotFoundComponent` — the fallback for any route
 * that doesn't define its own `notFoundComponent` (itinerary and editor
 * routes keep their existing, more specific 404 copy; this only covers
 * genuinely unmatched URLs).
 */
export function RouteNotFoundFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <RouteSketch seed="not-found" stops={3} className="h-16 w-40 opacity-70" />
      <h1 className="font-display text-2xl text-ink">
        {m.app_not_found_title()}
      </h1>
      <p className="max-w-[45ch] text-sm text-ink-soft">
        {m.app_not_found_description()}
      </p>
      <Button asChild>
        <Link to="/">{m.app_not_found_home()}</Link>
      </Button>
    </div>
  )
}
