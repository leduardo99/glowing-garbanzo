import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { m } from '#/paraglide/messages'
import type { ItineraryDetail } from '#/server/itineraries'

/**
 * The itinerary's own identity: cover, title, destination/summary, the
 * author/day-count/forked-from meta line, and style tags. This is the
 * one place `.font-display` (Fraunces) appears at its full hero size —
 * the itinerary's name is the single piece of content on this page the
 * Editorial Title Rule reserves a serif for.
 */
export function ItineraryHero({ data }: { data: ItineraryDetail }) {
  return (
    <header className="flex flex-col gap-4">
      {data.coverImageUrl ? (
        // Concentric radius: the card/page uses `rounded-lg` (14px); the
        // cover sits flush inside the header with no card padding around
        // it here, so it keeps the same 14px rather than a reduced one.
        <img
          src={data.coverImageUrl}
          alt=""
          className="h-56 w-full rounded-lg object-cover sm:h-72"
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-display text-ink sm:text-[2.5rem]">
          {data.title}
        </h1>
        {data.destination ? (
          <p className="text-title text-ink-soft">{data.destination}</p>
        ) : null}
        {data.summary ? (
          <p className="measure-prose text-body text-ink-soft">
            {data.summary}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-label text-ink-soft">
        <span className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarImage src={data.author.image ?? undefined} alt="" />
            <AvatarFallback>
              {data.author.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {m.view_by_author({ name: data.author.name })}
        </span>

        <span className="tabular-nums">
          {m.view_days_count({ count: data.days.length })}
        </span>

        {data.forkedFrom ? (
          <Link
            to="/itineraries/$slug"
            params={{ slug: data.forkedFrom.slug }}
            className="underline underline-offset-4 hover:text-ink"
          >
            {m.view_forked_from({ title: data.forkedFrom.title })}
          </Link>
        ) : null}
      </div>

      {data.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((tag) => (
            <Badge key={tag} variant="tag">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </header>
  )
}
