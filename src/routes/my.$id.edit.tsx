import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { ArrowLeftIcon, SearchXIcon } from 'lucide-react'

import { DayEditor } from '#/components/editor/DayEditor'
import { MembersCard } from '#/components/editor/MembersCard'
import { MetadataForm } from '#/components/editor/MetadataForm'
import { PublishCard } from '#/components/editor/PublishCard'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { myItineraryQueryOptions } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { EditorItinerary } from '#/server/itineraries'

/**
 * Editor route, loaded by id (author-only — see `getMyItineraryImpl`'s
 * doc comment). A non-author or an unknown id both surface as the same
 * generic 404 (`notFoundComponent`) — the design doc's Errors section
 * applies the same "don't leak existence" rule here as it does to the
 * public view route, just via FORBIDDEN/NOT_FOUND rather than a single
 * collapsed sentinel (this is a mutation-path server function, not a
 * read-access one).
 */
export const Route = createFileRoute('/my/$id/edit')({
  beforeLoad: ({ context, location }) => {
    if (!context.session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  loader: async ({ params, context }) => {
    try {
      await context.queryClient.ensureQueryData(
        myItineraryQueryOptions({ id: params.id }),
      )
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'NOT_FOUND' || error.message === 'FORBIDDEN')
      ) {
        throw notFound()
      }
      throw error
    }
  },
  notFoundComponent: EditorNotFound,
  component: EditorPage,
})

function EditorNotFound() {
  return (
    <div className="mx-auto max-w-xl p-8">
      <Empty>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>{m.editor_not_found_title()}</EmptyTitle>
        <EmptyDescription>{m.editor_not_found_description()}</EmptyDescription>
        <Button asChild variant="outline">
          <Link to="/my">{m.editor_back_to_my()}</Link>
        </Button>
      </Empty>
    </div>
  )
}

/**
 * Compact status/visibility indicator that sits next to the itinerary title
 * instead of being buried inside the Publication card — DESIGN.md's "status
 * near the title" instinct for anything currently in an active, changeable
 * state. Read-only: the actual publish/unpublish and visibility controls
 * still live in `PublishCard`, this is purely a glanceable summary.
 */
function EditorStatusPill({
  status,
  visibility,
}: {
  status: EditorItinerary['status']
  visibility: EditorItinerary['visibility']
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-full bg-surface px-3 py-1.5 shadow-resting">
      <span className="flex items-center gap-1.5 text-label font-medium text-ink">
        <span
          aria-hidden="true"
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            status === 'published' ? 'bg-success' : 'bg-warning',
          )}
        />
        {status === 'published'
          ? m.publish_status_published()
          : m.publish_status_draft()}
      </span>
      <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
      <span className="text-label text-ink-soft">
        {visibility === 'private'
          ? m.publish_visibility_private()
          : m.publish_visibility_public()}
      </span>
    </div>
  )
}

function EditorPage() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(myItineraryQueryOptions({ id }))

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-4 sm:p-6">
      <Link
        to="/my"
        className="flex items-center gap-1 text-label text-ink-soft hover:text-ink"
      >
        <ArrowLeftIcon data-icon="inline-start" className="size-4" />
        {m.editor_back_to_my()}
      </Link>

      {/*
        The editor's own page heading: the itinerary's name in Fraunces
        (Editorial Title Rule — this is content the author wrote, not
        interface chrome), with status/visibility glanceable right beside
        it instead of buried three sections down in Publication.
      */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-display text-display text-ink">
            {data.title}
          </h1>
          {data.destination ? (
            <p className="text-title text-ink-soft">{data.destination}</p>
          ) : null}
        </div>
        <EditorStatusPill status={data.status} visibility={data.visibility} />
      </header>

      <MetadataForm itinerary={data} />

      {/*
        Days are the itinerary's actual content and the thing an author
        spends the most time on — they come right after the title/cover
        form and ahead of publish/member settings, which are secondary,
        occasional actions (DESIGN.md's "content leads, chrome recedes"
        principle applied to the editor itself).
      */}
      <DayEditor itineraryId={data.id} days={data.days} />

      <PublishCard
        itineraryId={data.id}
        status={data.status}
        visibility={data.visibility}
      />

      {data.visibility === 'private' ? (
        <MembersCard
          itineraryId={data.id}
          slug={data.slug}
          inviteToken={data.inviteToken}
        />
      ) : null}
    </div>
  )
}
