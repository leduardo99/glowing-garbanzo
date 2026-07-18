import { z } from 'zod'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { SearchXIcon, StarIcon, TicketXIcon } from 'lucide-react'

import { StopList } from '#/components/StopList'
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
import { itineraryQueryOptions } from '#/lib/queries'
import { m } from '#/paraglide/messages'
import { joinByInviteToken } from '#/server/members'

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

    try {
      await context.queryClient.ensureQueryData(
        itineraryQueryOptions({ slug: params.slug, inviteToken: deps.invite }),
      )
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        throw notFound({ data: { invite: Boolean(deps.invite) } })
      }
      throw error
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

          <span className="flex items-center gap-1">
            <StarIcon
              data-icon="inline-start"
              className="fill-current text-amber-500"
            />
            {data.ratingAvg !== null
              ? `${data.ratingAvg.toFixed(1)} · ${m.view_rating_count({ count: data.ratingCount })}`
              : m.view_no_ratings()}
          </span>

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
      </header>

      <Separator />

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
    </div>
  )
}
