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
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
