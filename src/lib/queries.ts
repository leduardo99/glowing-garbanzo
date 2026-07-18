/**
 * TanStack Query `queryOptions()` factories for the discovery/view routes.
 * Shared by route `loader`s (via `context.queryClient.ensureQueryData`) and
 * components (via `useSuspenseQuery`) so both sides always agree on the
 * query key and fetcher — reused by later tasks (favorite/rate/comment
 * mutations invalidate the same keys).
 */
import { queryOptions } from '@tanstack/react-query'

import { getItineraryBySlug, searchItineraries } from '#/server/itineraries'
import type {
  GetItineraryBySlugInput,
  SearchItinerariesInput,
} from '#/server/itineraries'

/** Discovery search results (home route). */
export function searchQueryOptions(params: SearchItinerariesInput) {
  return queryOptions({
    queryKey: ['itineraries', 'search', params] as const,
    queryFn: () => searchItineraries({ data: params }),
  })
}

/**
 * Single itinerary detail (view route), keyed by slug + optional invite
 * token — a token changes what the query is allowed to see, so it's part
 * of the cache key rather than a fire-and-forget side input.
 */
export function itineraryQueryOptions({
  slug,
  inviteToken,
}: GetItineraryBySlugInput) {
  return queryOptions({
    queryKey: ['itineraries', 'detail', slug, inviteToken ?? null] as const,
    queryFn: () => getItineraryBySlug({ data: { slug, inviteToken } }),
  })
}
