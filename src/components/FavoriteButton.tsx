import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { HeartIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { useMutationErrorHandler } from '#/lib/mutation-errors'
import { itineraryQueryOptions } from '#/lib/queries'
import { m } from '#/paraglide/messages'
import { toggleFavorite } from '#/server/engagement'
import type { ItineraryDetail } from '#/server/itineraries'

/**
 * Heart toggle for the view page. Logged out renders a CTA linking
 * `/login?redirect=<current>` instead of a live button — favoriting always
 * requires a session, so there's nothing to gate client-side beyond that.
 *
 * Mirrors `RatingStars`'s optimistic-update strategy: flips
 * `viewer.isFavorite` on the cached itinerary detail query
 * (`itineraryQueryOptions`, keyed by `slug`/`inviteToken`) immediately, then
 * reconciles with the server's actual `favorite` flag on success and
 * invalidates broadly on settle — favoriting also affects the `/my`
 * favorites list, which lives under the same `'itineraries'` query-key tag.
 */
export function FavoriteButton({
  itineraryId,
  slug,
  inviteToken,
  isFavorite,
  loggedIn,
  redirectTarget,
}: {
  itineraryId: string
  slug: string
  inviteToken?: string
  isFavorite: boolean
  loggedIn: boolean
  redirectTarget: string
}) {
  const queryClient = useQueryClient()
  const queryKey = itineraryQueryOptions({ slug, inviteToken }).queryKey
  const handleMutationError = useMutationErrorHandler(redirectTarget)

  const mutation = useMutation({
    mutationFn: () => toggleFavorite({ data: { itineraryId } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ItineraryDetail>(queryKey)
      if (previous) {
        queryClient.setQueryData<ItineraryDetail>(queryKey, {
          ...previous,
          viewer: { ...previous.viewer, isFavorite: !previous.viewer.isFavorite },
        })
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      handleMutationError(error, () => toast.error(m.favorite_error()))
    },
    onSuccess: (result) => {
      queryClient.setQueryData<ItineraryDetail>(queryKey, (current) =>
        current
          ? { ...current, viewer: { ...current.viewer, isFavorite: result.favorite } }
          : current,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'itineraries',
      })
    },
  })

  if (!loggedIn) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/login" search={{ redirect: redirectTarget }}>
          <HeartIcon data-icon="inline-start" />
          {m.favorite_login_cta()}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={isFavorite ? 'default' : 'outline'}
      size="sm"
      disabled={mutation.isPending}
      aria-pressed={isFavorite}
      onClick={() => mutation.mutate()}
    >
      <HeartIcon
        data-icon="inline-start"
        className={isFavorite ? 'fill-current' : undefined}
      />
      {isFavorite ? m.favorite_remove() : m.favorite_add()}
    </Button>
  )
}
