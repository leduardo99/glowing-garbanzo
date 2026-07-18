import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { GitForkIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { useMutationErrorHandler } from '#/lib/mutation-errors'
import { m } from '#/paraglide/messages'
import { forkItinerary } from '#/server/itineraries'

/**
 * Forks the itinerary into a new draft owned by the caller and navigates
 * straight to its editor. Logged out renders a login CTA instead — forking
 * always requires a session (same rule as favorite/comment).
 */
export function ForkButton({
  itineraryId,
  loggedIn,
  redirectTarget,
}: {
  itineraryId: string
  loggedIn: boolean
  redirectTarget: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const handleMutationError = useMutationErrorHandler(redirectTarget)

  const mutation = useMutation({
    mutationFn: () => forkItinerary({ data: { id: itineraryId } }),
    onSuccess: (result) => {
      // The fork shows up in the caller's `/my` "mine" list immediately.
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'itineraries',
      })
      toast.success(m.fork_created())
      void navigate({ to: '/my/$id/edit', params: { id: result.id } })
    },
    onError: (error) =>
      handleMutationError(error, () => toast.error(m.fork_error())),
  })

  if (!loggedIn) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/login" search={{ redirect: redirectTarget }}>
          <GitForkIcon data-icon="inline-start" />
          {m.fork_login_cta()}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <GitForkIcon data-icon="inline-start" />
      {m.fork_action()}
    </Button>
  )
}
