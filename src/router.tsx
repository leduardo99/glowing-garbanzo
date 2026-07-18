import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from './integrations/tanstack-query/root-provider'
import {
  RouteErrorFallback,
  RouteNotFoundFallback,
  RoutePendingFallback,
} from './components/RouteFallbacks'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // App-wide fallbacks — there was previously no error boundary at all,
    // so an uncaught render/loader error surfaced as a blank page. Route
    // files that define their own `notFoundComponent` (itinerary, editor)
    // keep taking precedence over `defaultNotFoundComponent`.
    defaultPendingComponent: RoutePendingFallback,
    defaultErrorComponent: RouteErrorFallback,
    defaultNotFoundComponent: RouteNotFoundFallback,
    // Subtle app-grade route transitions (DESIGN.md's Motion section,
    // "Calm, purposeful motion") — every navigation gets a quiet crossfade
    // by default; specific Links opt into a directional `nav-forward`/
    // `nav-back` type (see ItineraryCard, ItineraryHero's back link,
    // EditorPage's back link) for the one hierarchical list↔detail
    // navigation in the app. Progressive enhancement: this is
    // `@tanstack/react-router`'s native `document.startViewTransition`
    // wiring, which already no-ops on browsers without View Transitions
    // support — no feature-detection or extra library needed (React's
    // `<ViewTransition>` component isn't available on stable React 19).
    defaultViewTransition: true,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
