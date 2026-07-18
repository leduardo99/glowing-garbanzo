/**
 * TanStack Query `queryOptions()` factories for the discovery/view/editor
 * routes. Shared by route `loader`s (via `context.queryClient.ensureQueryData`)
 * and components (via `useSuspenseQuery`) so both sides always agree on the
 * query key and fetcher — reused across tasks (favorite/rate/comment/editor
 * mutations invalidate the same keys).
 *
 * Every key starts with the `'itineraries'` tag, so editor mutations that
 * don't know which exact cached queries are affected (e.g. publishing might
 * be reflected in the discovery search, the `/my` lists, AND the detail
 * view) can invalidate broadly via a `queryKey[0] === 'itineraries'`
 * predicate instead of enumerating every specific key.
 */
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { listComments } from '#/server/engagement'
import {
  getItineraryBySlug,
  getMyItinerary,
  listMyFavorites,
  listMyItineraries,
  searchItineraries,
} from '#/server/itineraries'
import type {
  GetItineraryBySlugInput,
  GetMyItineraryInput,
  ListMyFavoritesInput,
  ListMyItinerariesInput,
  SearchItinerariesInput,
} from '#/server/itineraries'
import { listMembers } from '#/server/members'
import type { ListMembersInput } from '#/server/members'

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

/** `/my` "mine" tab: the caller's own itineraries, drafts and published. */
export function myItinerariesQueryOptions(params: ListMyItinerariesInput) {
  return queryOptions({
    queryKey: ['itineraries', 'mine', params] as const,
    queryFn: () => listMyItineraries({ data: params }),
  })
}

/** `/my` "favorites" tab. */
export function myFavoritesQueryOptions(params: ListMyFavoritesInput) {
  return queryOptions({
    queryKey: ['itineraries', 'favorites', params] as const,
    queryFn: () => listMyFavorites({ data: params }),
  })
}

/** Editor route (`/my/$id/edit`): full by-id data, author only. */
export function myItineraryQueryOptions({ id }: GetMyItineraryInput) {
  return queryOptions({
    queryKey: ['itineraries', 'editor', id] as const,
    queryFn: () => getMyItinerary({ data: { id } }),
  })
}

/** MembersCard (editor route, private itineraries only). */
export function membersQueryOptions({ id }: ListMembersInput) {
  return queryOptions({
    queryKey: ['itineraries', 'members', id] as const,
    queryFn: () => listMembers({ data: { id } }),
  })
}

/**
 * `Comments` (view route): newest-first, paginated. An infinite query so
 * "load more" appends pages instead of replacing them — `getNextPageParam`
 * compares how many items have loaded so far against the server's `total`
 * and returns the next 1-indexed page number, or `undefined` once every
 * comment is loaded (which tells the query there's no next page).
 *
 * `inviteToken` is part of the key for the same reason as
 * `itineraryQueryOptions` — it changes what the query is allowed to see
 * (the anonymous invite-link viewer of a private itinerary), so it can't be
 * a fire-and-forget side input.
 */
export function commentsQueryOptions({
  itineraryId,
  inviteToken,
}: {
  itineraryId: string
  inviteToken?: string
}) {
  return infiniteQueryOptions({
    queryKey: ['itineraries', 'comments', itineraryId, inviteToken ?? null] as const,
    queryFn: ({ pageParam }) =>
      listComments({ data: { itineraryId, page: pageParam, inviteToken } }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
  })
}
