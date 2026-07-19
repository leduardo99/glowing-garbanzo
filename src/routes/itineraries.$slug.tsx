import { Suspense, lazy, useMemo, useState } from 'react'
import { z } from 'zod'
import { useInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import {
  ChevronRightIcon,
  MessageCircleIcon,
  SearchXIcon,
  TicketXIcon,
} from 'lucide-react'

import { Comments } from '#/components/Comments'
import { DayTimeline } from '#/components/itinerary/DayTimeline'
import { EngagementBar } from '#/components/itinerary/EngagementBar'
import { ItineraryHero } from '#/components/itinerary/ItineraryHero'
import { ItineraryViewProvider } from '#/components/itinerary/ItineraryViewContext'
import type { ItineraryMapStop } from '#/components/map/ItineraryMap'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { useIsMobile } from '#/hooks/use-is-mobile'
import { commentsQueryOptions, itineraryQueryOptions } from '#/lib/queries'
import { m } from '#/paraglide/messages'
import { joinByInviteToken } from '#/server/members'
import type { DayView } from '#/server/itineraries'

// Lazy so `maplibre-gl` only loads for itineraries that actually have
// mappable stops — `ItineraryView` below skips rendering (and thus
// importing) this entirely when `mapStops` is empty.
const ItineraryMap = lazy(() => import('#/components/map/ItineraryMap'))

/** Every stop across all days that has both `lat` and `lng` set, flattened with its day number for the map's popups. */
function collectMapStops(days: DayView[]): ItineraryMapStop[] {
  const stops: ItineraryMapStop[] = []
  // `sequence` counts EVERY stop (not just geocoded ones) so the map's
  // numbered discs always agree with the timeline's numbering — a stop
  // without a pin simply skips its number on the map.
  let sequence = 0
  for (const day of days) {
    for (const stop of day.stops) {
      sequence += 1
      if (stop.lat !== null && stop.lng !== null) {
        stops.push({
          id: stop.id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          dayNumber: day.dayNumber,
          sequence,
        })
      }
    }
  }
  return stops
}

const viewSearchSchema = z.object({
  invite: z.string().optional(),
})

export const Route = createFileRoute('/itineraries/$slug')({
  validateSearch: viewSearchSchema,
  loaderDeps: ({ search }) => ({ invite: search.invite }),
  loader: async ({ params, deps, context, preload }) => {
    // Join as a member before loading the detail so `viewer.isMember`
    // reflects it immediately. Guarded by `!preload` — a `Link` hover
    // (intent preload) must not silently join a private itinerary the
    // user never actually navigated to.
    if (deps.invite && context.session && !preload) {
      try {
        await joinByInviteToken({
          data: { slug: params.slug, token: deps.invite },
        })
      } catch {
        // Invalid/expired/foreign token — ignore here. The detail fetch
        // below is the source of truth for access and 404s with the
        // invite-aware message if the token doesn't actually grant access.
      }
    }

    let detail
    try {
      detail = await context.queryClient.ensureQueryData(
        itineraryQueryOptions({ slug: params.slug, inviteToken: deps.invite }),
      )
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        throw notFound({ data: { invite: Boolean(deps.invite) } })
      }
      throw error
    }

    // Preload the first page of comments too — same read access as the
    // itinerary itself (already confirmed above). SSR-renders the first
    // comments page instead of a client-only fetch-after-hydrate.
    //
    // Best-effort: this is an optimization, not a requirement, so it's
    // wrapped in its own try/catch instead of the loader's — `listComments`
    // has its own access check (mirroring, but independent of, the one
    // above), and any drift between the two or other transient failure here
    // must not crash the whole page. If it fails, `Comments`' own
    // `useInfiniteQuery` — given the same `inviteToken` — just fetches
    // client-side after hydration instead.
    try {
      await context.queryClient.ensureInfiniteQueryData(
        commentsQueryOptions({
          itineraryId: detail.id,
          inviteToken: deps.invite,
        }),
      )
    } catch {
      // Swallowed intentionally — see comment above.
    }
  },
  notFoundComponent: ItineraryNotFound,
  component: ItineraryView,
})

function ItineraryNotFound({ data }: { data?: unknown }) {
  const isInvite =
    typeof data === 'object' &&
    data !== null &&
    (data as { invite?: boolean }).invite === true

  return (
    <div className="mx-auto max-w-xl p-8">
      <Empty>
        <EmptyMedia variant="icon">
          {isInvite ? <TicketXIcon /> : <SearchXIcon />}
        </EmptyMedia>
        <EmptyTitle>
          {isInvite ? m.view_invite_invalid_title() : m.view_not_found_title()}
        </EmptyTitle>
        <EmptyDescription>
          {isInvite
            ? m.view_invite_invalid_description()
            : m.view_not_found_description()}
        </EmptyDescription>
        <Button asChild variant="outline">
          <Link to="/">{m.view_back_home()}</Link>
        </Button>
      </Empty>
    </div>
  )
}

function ItineraryView() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const { session } = Route.useRouteContext()
  const { data } = useSuspenseQuery(
    itineraryQueryOptions({ slug, inviteToken: search.invite }),
  )

  const inviteToken = search.invite
  const showInviteLoginCta =
    Boolean(inviteToken) &&
    !session &&
    !data.viewer.isMember &&
    !data.viewer.canEdit
  const redirectTarget = inviteToken
    ? `/itineraries/${slug}?invite=${encodeURIComponent(inviteToken)}`
    : `/itineraries/${slug}`

  const mapStops = useMemo(() => collectMapStops(data.days), [data.days])

  // UI-side approximation of the server's `canRate` rule (logged in +
  // published + public) — the server re-checks the real rule on every
  // `rateItinerary` call regardless; this only decides whether
  // `RatingStars` renders live buttons or a read-only summary.
  const canRate =
    Boolean(session) &&
    data.status === 'published' &&
    data.visibility === 'public'

  // Same query the loader already `ensureInfiniteQueryData`'d and
  // `Comments` itself reads — calling it again here just subscribes to the
  // already-cached result (same query key, React Query dedupes) so the
  // mobile "view comments" trigger below can show a live count without a
  // second network round trip or any server-side change.
  const commentsQuery = useInfiniteQuery(
    commentsQueryOptions({ itineraryId: data.id, inviteToken }),
  )
  const commentCount = commentsQuery.data?.pages[0]?.total ?? 0

  const isMobile = useIsMobile()
  const [commentsOpen, setCommentsOpen] = useState(false)

  return (
    <ItineraryViewProvider
      value={{
        itineraryId: data.id,
        slug,
        inviteToken,
        redirectTarget,
        session,
        canRate,
      }}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-8 p-4 sm:p-6 md:max-w-6xl">
        {showInviteLoginCta ? (
          <Card>
            <CardHeader>
              <CardTitle>{m.view_invite_login_title()}</CardTitle>
              <CardDescription>
                {m.view_invite_login_description()}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild>
                <Link to="/login" search={{ redirect: redirectTarget }}>
                  {m.view_invite_login_cta()}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        <ItineraryHero data={data} />

        {/*
          Sticky compact engagement bar (DESIGN.md's app-shell motion
          section): pins under the header once the hero scrolls past it on
          mobile, matching the immersive hero's edge-to-edge bleed via the
          same negative-margin trick. Desktop keeps the bar in normal flow,
          unchanged from the previous pass.
        */}
        <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <EngagementBar
            ratingAvg={data.ratingAvg}
            ratingCount={data.ratingCount}
            myStars={data.viewer.myStars}
            isFavorite={data.viewer.isFavorite}
          />
        </div>

        <Separator className="hidden md:block" />

        {/*
          The route is the protagonist (DESIGN.md "The Drawn Route",
          Polarsteps reference): on desktop the map becomes a sticky
          right-hand column that rides along while the day timeline
          scrolls — list and map as two live views of the same journey.
          On mobile the map keeps its full-width slot above the timeline.
          One DOM node for both layouts (CSS grid placement only), so the
          map never re-initializes across the breakpoint; MapLibre's own
          ResizeObserver absorbs the size change.
        */}
        <div className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:items-start md:gap-10">
          {mapStops.length > 0 ? (
            <div className="md:sticky md:top-6 md:col-start-2 md:row-start-1">
              <Suspense
                fallback={
                  <Skeleton
                    role="status"
                    aria-label={m.app_loading()}
                    className="h-80 w-full rounded-lg md:h-[70vh]"
                  />
                }
              >
                <ItineraryMap
                  stops={mapStops}
                  className="md:h-[70vh] md:max-h-[42rem]"
                />
              </Suspense>
            </div>
          ) : null}

          <div className="min-w-0 md:col-start-1 md:row-start-1">
            <DayTimeline days={data.days} />
          </div>
        </div>

        <Separator />

        {/*
          Comments: a bottom sheet on mobile (native "open thread" pattern
          — a full inline list would push the day timeline far down a
          small screen), inline on desktop exactly as before. `isMobile`
          defaults to `false` during SSR/first paint, so the server (and
          the very first client render) always render the desktop branch
          (`Comments` inline) — see `useIsMobile`'s doc comment.
        */}
        {isMobile ? (
          <>
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface px-4 py-3.5 text-left shadow-resting transition-shadow hover:shadow-lifted"
            >
              <span className="flex items-center gap-2 text-title font-semibold text-ink">
                <MessageCircleIcon
                  aria-hidden="true"
                  className="size-4 text-ink-soft"
                />
                {m.view_comments_open({ count: commentCount })}
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className="size-4 text-ink-soft"
              />
            </button>

            <Drawer open={commentsOpen} onOpenChange={setCommentsOpen}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>{m.comments_title()}</DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-4">
                  <Comments showTitle={false} />
                </div>
              </DrawerContent>
            </Drawer>
          </>
        ) : (
          <Comments />
        )}
      </div>
    </ItineraryViewProvider>
  )
}
