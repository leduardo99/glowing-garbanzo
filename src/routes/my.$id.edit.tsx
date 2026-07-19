import { Suspense, lazy, useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { ArrowLeftIcon, SearchXIcon, SparklesIcon } from 'lucide-react'
import { z } from 'zod'

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
import { formatCost, sumTripCostCents } from '#/lib/currency'
import { collectMapStops } from '#/lib/map-stops'
import { myItineraryQueryOptions } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { EditorItinerary } from '#/server/itineraries'

// Lazy so `maplibre-gl` only loads once the editor actually has a pin to
// show (same rationale as the detail page's map).
const ItineraryMap = lazy(() => import('#/components/map/ItineraryMap'))
// Lazy for the same reason: the assistant (and its chat machinery) only
// loads for authors who open it.
const AssistantPanel = lazy(() => import('#/components/editor/AssistantPanel'))

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
  // `?assistant=1` (set by /new's AI flow) opens the editor with the
  // assistant panel already docked.
  validateSearch: z.object({ assistant: z.boolean().optional() }),
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
  const { assistant } = Route.useSearch()
  const { data } = useSuspenseQuery(myItineraryQueryOptions({ id }))
  const [assistantOpen, setAssistantOpen] = useState(Boolean(assistant))
  const mapStops = useMemo(() => collectMapStops(data.days), [data.days])
  const tripTotalCents = useMemo(() => sumTripCostCents(data.days), [data.days])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-4 sm:p-6 xl:max-w-7xl">
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
          {tripTotalCents > 0 ? (
            <p className="text-label text-ink-soft tabular-nums">
              {m.editor_trip_total({
                amount: formatCost(tripTotalCents, data.currency),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAssistantOpen(true)}
            className="gap-1.5"
          >
            <SparklesIcon aria-hidden="true" className="size-4 text-mata" />
            {m.assistant_open()}
          </Button>
          <EditorStatusPill status={data.status} visibility={data.visibility} />
        </div>
      </header>

      {/*
        Route Studio split (xl+): the editing column beside a live, sticky
        map of the draft — every geocoded stop pins with the timeline's
        own number, and updates land as mutations invalidate. Below xl the
        map simply isn't mounted (the per-stop PlacePicker already covers
        location editing on small screens).
      */}
      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <MetadataForm itinerary={data} />

          {/*
            Days are the itinerary's actual content and the thing an author
            spends the most time on — they come right after the title/cover
            form and ahead of publish/member settings, which are secondary,
            occasional actions (DESIGN.md's "content leads, chrome recedes"
            principle applied to the editor itself).
          */}
          <DayEditor
            itineraryId={data.id}
            days={data.days}
            currency={data.currency}
          />

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

        {mapStops.length > 0 ? (
          <div className="hidden xl:block xl:sticky xl:top-6">
            <Suspense fallback={null}>
              <ItineraryMap stops={mapStops} className="h-[70vh] w-full" />
            </Suspense>
          </div>
        ) : null}
      </div>

      {assistantOpen ? (
        <Suspense fallback={null}>
          <AssistantPanel
            itineraryId={data.id}
            onClose={() => setAssistantOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
