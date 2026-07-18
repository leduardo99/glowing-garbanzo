import { Suspense, lazy, useMemo } from 'react'
import { z } from 'zod'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { SearchXIcon, TicketXIcon } from 'lucide-react'

import { Comments } from '#/components/Comments'
import { FavoriteButton } from '#/components/FavoriteButton'
import { ForkButton } from '#/components/ForkButton'
import { RatingStars } from '#/components/RatingStars'
import { StopList } from '#/components/StopList'
import type { ItineraryMapStop } from '#/components/map/ItineraryMap'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Separator } from '#/components/ui/separator'
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
  for (const day of days) {
    for (const stop of day.stops) {
      if (stop.lat !== null && stop.lng !== null) {
        stops.push({
          id: stop.id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          dayNumber: day.dayNumber,
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
    // itinerary itself (already confirmed above), so this can't fail for a
    // reason the itinerary fetch wouldn't have already caught. SSR-renders
    // the first comments page instead of a client-only fetch-after-hydrate.
    await context.queryClient.ensureInfiniteQueryData(
      commentsQueryOptions({ itineraryId: detail.id }),
    )
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
    Boolean(session) && data.status === 'published' && data.visibility === 'public'

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
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

      <header className="flex flex-col gap-4">
        {data.coverImageUrl ? (
          <img
            src={data.coverImageUrl}
            alt=""
            className="h-64 w-full rounded-lg object-cover"
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{data.title}</h1>
          {data.destination ? (
            <p className="text-lg text-muted-foreground">{data.destination}</p>
          ) : null}
          {data.summary ? (
            <p className="text-muted-foreground">{data.summary}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarImage src={data.author.image ?? undefined} alt="" />
              <AvatarFallback>
                {data.author.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {m.view_by_author({ name: data.author.name })}
          </span>

          <span>{m.view_days_count({ count: data.days.length })}</span>

          {data.forkedFrom ? (
            <Link
              to="/itineraries/$slug"
              params={{ slug: data.forkedFrom.slug }}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {m.view_forked_from({ title: data.forkedFrom.title })}
            </Link>
          ) : null}
        </div>

        {data.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <RatingStars
            itineraryId={data.id}
            slug={slug}
            inviteToken={inviteToken}
            ratingAvg={data.ratingAvg}
            ratingCount={data.ratingCount}
            myStars={data.viewer.myStars}
            canRate={canRate}
            redirectTarget={redirectTarget}
          />
          <FavoriteButton
            itineraryId={data.id}
            slug={slug}
            inviteToken={inviteToken}
            isFavorite={data.viewer.isFavorite}
            loggedIn={Boolean(session)}
            redirectTarget={redirectTarget}
          />
          <ForkButton
            itineraryId={data.id}
            loggedIn={Boolean(session)}
            redirectTarget={redirectTarget}
          />
        </div>
      </header>

      <Separator />

      {mapStops.length > 0 ? (
        <Suspense fallback={<div className="h-80 w-full animate-pulse rounded-lg bg-muted" />}>
          <ItineraryMap stops={mapStops} />
        </Suspense>
      ) : null}

      <div className="flex flex-col gap-8">
        {data.days.map((day) => (
          <section key={day.id} className="flex flex-col gap-3">
            <h2 className="flex items-baseline gap-2 text-xl font-semibold">
              <span>{m.view_day_label({ number: day.dayNumber })}</span>
              {day.title ? (
                <span className="text-base font-normal text-muted-foreground">
                  {day.title}
                </span>
              ) : null}
            </h2>
            {day.note ? (
              <p className="text-sm text-muted-foreground">{day.note}</p>
            ) : null}
            {day.stops.length > 0 ? <StopList stops={day.stops} /> : null}
          </section>
        ))}
      </div>

      <Separator />

      <Comments
        itineraryId={data.id}
        currentUserId={session?.id ?? null}
        redirectTarget={redirectTarget}
      />
    </div>
  )
}
