import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StarIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useMutationErrorHandler } from '#/lib/mutation-errors'
import { itineraryQueryOptions } from '#/lib/queries'
import { m } from '#/paraglide/messages'
import { rateItinerary } from '#/server/engagement'
import type { ItineraryDetail } from '#/server/itineraries'

const STAR_VALUES = [1, 2, 3, 4, 5] as const

/**
 * 5-star rating widget for the view page.
 *
 * `canRate` is the UI-side approximation of the server's `canRate` rule
 * (logged in + published + public) computed by the caller from viewer
 * context — the server re-checks the real rule on every mutation
 * regardless, this only decides whether to render live buttons or a
 * read-only summary. When not allowed, renders the average + count only
 * (same as the old static summary this replaces).
 *
 * Clicking a star optimistically sets `viewer.myStars` on the itinerary
 * detail query (`itineraryQueryOptions`, keyed by `slug`/`inviteToken`) so
 * the filled-star count updates instantly; the mutation result's
 * `ratingAvg`/`ratingCount` then replace the cached values, and the query
 * is invalidated afterwards (broadly — a new rating can also change the
 * "top rated" sort on the discovery page) to reconcile with the server.
 */
export function RatingStars({
  itineraryId,
  slug,
  inviteToken,
  ratingAvg,
  ratingCount,
  myStars,
  canRate,
  redirectTarget,
}: {
  itineraryId: string
  slug: string
  inviteToken?: string
  ratingAvg: number | null
  ratingCount: number
  myStars: number | null
  canRate: boolean
  redirectTarget: string
}) {
  const queryClient = useQueryClient()
  const queryKey = itineraryQueryOptions({ slug, inviteToken }).queryKey
  const handleMutationError = useMutationErrorHandler(redirectTarget)

  const mutation = useMutation({
    mutationFn: (stars: number) =>
      rateItinerary({ data: { id: itineraryId, stars } }),
    onMutate: async (stars) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ItineraryDetail>(queryKey)
      if (previous) {
        queryClient.setQueryData<ItineraryDetail>(queryKey, {
          ...previous,
          viewer: { ...previous.viewer, myStars: stars },
        })
      }
      return { previous }
    },
    onError: (error, _stars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      handleMutationError(error, () => toast.error(m.rate_error()))
    },
    onSuccess: (result) => {
      queryClient.setQueryData<ItineraryDetail>(queryKey, (current) =>
        current
          ? {
              ...current,
              ratingAvg: result.ratingAvg,
              ratingCount: result.ratingCount,
            }
          : current,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'itineraries',
      })
    },
  })

  const activeStars = myStars ?? Math.round(ratingAvg ?? 0)

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center"
        role={canRate ? 'radiogroup' : undefined}
        aria-label={canRate ? m.rate_action() : undefined}
      >
        {STAR_VALUES.map((value) =>
          canRate ? (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={activeStars >= value}
              aria-label={m.rate_star_label({ count: value })}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(value)}
              className="flex min-h-11 min-w-6 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              <StarIcon
                className={
                  activeStars >= value
                    ? 'size-5 fill-current text-amber'
                    : 'size-5 text-ink-soft'
                }
              />
            </button>
          ) : (
            <StarIcon
              key={value}
              aria-hidden="true"
              className={
                activeStars >= value
                  ? 'size-5 fill-current text-amber'
                  : 'size-5 text-ink-soft'
              }
            />
          ),
        )}
      </div>
      <span className="text-label tabular-nums text-ink-soft">
        {ratingAvg !== null
          ? `${ratingAvg.toFixed(1)} · ${m.view_rating_count({ count: ratingCount })}`
          : m.view_no_ratings()}
      </span>
    </div>
  )
}
