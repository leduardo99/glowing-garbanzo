import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '#/components/editor/ConfirmDialog'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { useMutationErrorHandler } from '#/lib/mutation-errors'
import { commentsQueryOptions } from '#/lib/queries'
import { formatRelativeTime } from '#/lib/relative-time'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { addComment, deleteComment } from '#/server/engagement'

/**
 * Comment list + add form for the view page.
 *
 * Pagination: an infinite query (`commentsQueryOptions`) rather than a
 * single page — "load more" appends the next page's items to what's
 * already rendered instead of replacing them, which is the UX the design
 * calls for. Add/delete both invalidate the same query key, which refetches
 * every page currently loaded (simplest way to keep pagination consistent
 * after a mutation, at the cost of a refetch per loaded page — comment
 * volume per itinerary is expected to be small in the MVP).
 *
 * Logged-out visitors see the list read-only plus a login CTA in place of
 * the add form — listing itself needs no session (mirrors itinerary view
 * access), only posting does.
 */
export function Comments({
  itineraryId,
  currentUserId,
  redirectTarget,
}: {
  itineraryId: string
  currentUserId: string | null
  redirectTarget: string
}) {
  const queryClient = useQueryClient()
  const handleMutationError = useMutationErrorHandler(redirectTarget)
  const queryKey = commentsQueryOptions({ itineraryId }).queryKey
  const locale = getLocale()

  const commentsQuery = useInfiniteQuery(commentsQueryOptions({ itineraryId }))
  const comments = commentsQuery.data?.pages.flatMap((page) => page.items) ?? []

  const [body, setBody] = useState('')

  const addMutation = useMutation({
    mutationFn: (text: string) =>
      addComment({ data: { itineraryId, body: text } }),
    onSuccess: () => {
      setBody('')
      void queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) =>
      handleMutationError(error, () => toast.error(m.comments_error())),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: (error) =>
      handleMutationError(error, () => toast.error(m.comments_delete_error())),
  })

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{m.comments_title()}</h2>

      {currentUserId ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = body.trim()
            if (!trimmed) return
            addMutation.mutate(trimmed)
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={m.comments_placeholder()}
            aria-label={m.comments_placeholder()}
            disabled={addMutation.isPending}
          />
          <Button
            type="submit"
            className="self-end"
            disabled={addMutation.isPending || body.trim().length === 0}
          >
            {m.comments_submit()}
          </Button>
        </form>
      ) : (
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link to="/login" search={{ redirect: redirectTarget }}>
            {m.comments_login_cta()}
          </Link>
        </Button>
      )}

      {comments.length === 0 && !commentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{m.comments_empty()}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-3">
              <Avatar size="sm">
                <AvatarImage src={comment.author.image ?? undefined} alt="" />
                <AvatarFallback>
                  {comment.author.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{comment.author.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(comment.createdAt, locale)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
              </div>
              {currentUserId === comment.author.id ? (
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={m.comments_delete()}
                    >
                      <Trash2Icon />
                    </Button>
                  }
                  title={m.comments_delete_confirm_title()}
                  description={m.comments_delete_confirm_description()}
                  onConfirm={() => deleteMutation.mutateAsync(comment.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {commentsQuery.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-center"
          disabled={commentsQuery.isFetchingNextPage}
          onClick={() => void commentsQuery.fetchNextPage()}
        >
          {m.comments_load_more()}
        </Button>
      ) : null}
    </section>
  )
}
