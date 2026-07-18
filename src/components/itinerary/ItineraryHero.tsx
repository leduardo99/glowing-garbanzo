import { ArrowLeftIcon } from 'lucide-react'
import { Link, useRouter } from '@tanstack/react-router'

import { CoverPlaceholder } from '#/components/CoverPlaceholder'
import { Badge } from '#/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { m } from '#/paraglide/messages'
import type { ItineraryDetail } from '#/server/itineraries'

/** Author line + day count + forked-from — shared between the mobile and desktop hero layouts. */
function MetaLine({ data }: { data: ItineraryDetail }) {
  return (
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
          viewTransition={{ types: ['nav-forward'] }}
          className="underline underline-offset-4 hover:text-ink"
        >
          {m.view_forked_from({ title: data.forkedFrom.title })}
        </Link>
      ) : null}
    </div>
  )
}

function TagRow({ data }: { data: ItineraryDetail }) {
  if (data.tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {data.tags.map((tag) => (
        <Badge key={tag} variant="tag">
          {tag}
        </Badge>
      ))}
    </div>
  )
}

/**
 * The itinerary's own identity: cover, title, destination/summary, the
 * author/day-count/forked-from meta line, and style tags.
 *
 * Two structurally different layouts, not just a CSS reflow of one:
 * - **Mobile (`<md`)**: an immersive, edge-to-edge cover (negative-margin
 *   bleed cancelling the page's own `p-4`/`sm:p-6`, per DESIGN.md's
 *   adaptation-not-scaling rule) with a translucent circular back button
 *   floating on it, and a title card overlapping the cover's bottom edge —
 *   the "immersive detail hero" app pattern (Uber Eats/Glovo restaurant
 *   pages), replacing the old stacked-form header entirely below `md`.
 * - **Desktop (`md+`)**: unchanged from the previous pass — a contained,
 *   rounded cover inside the page's own padding, title below it.
 *
 * This is also the one place `.font-display` (Fraunces) appears at its
 * full hero size — the itinerary's name is the single piece of content on
 * this page the Editorial Title Rule reserves a serif for.
 */
export function ItineraryHero({ data }: { data: ItineraryDetail }) {
  const router = useRouter()

  return (
    <>
      {/* Mobile immersive hero */}
      <header className="flex flex-col gap-4 md:hidden">
        <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
          {data.coverImageUrl ? (
            <img
              src={data.coverImageUrl}
              alt=""
              className="h-64 w-full object-cover"
            />
          ) : (
            <CoverPlaceholder className="h-64 w-full" />
          )}

          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label={m.view_back()}
            className="absolute top-4 left-4 flex size-10 items-center justify-center rounded-full bg-ink/45 text-paper backdrop-blur-sm transition-colors hover:bg-ink/60"
          >
            <ArrowLeftIcon className="size-5" aria-hidden="true" />
          </button>

          {/* Title card overlapping the cover's bottom edge. */}
          <div className="relative z-10 -mt-8 mx-4 flex flex-col gap-1 rounded-xl bg-paper p-4 shadow-elevated">
            <h1 className="font-display text-display text-ink">
              {data.title}
            </h1>
            {data.destination ? (
              <p className="text-title text-ink-soft">{data.destination}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-1">
          {data.summary ? (
            <p className="measure-prose text-body text-ink-soft">
              {data.summary}
            </p>
          ) : null}
          <MetaLine data={data} />
          <TagRow data={data} />
        </div>
      </header>

      {/* Desktop hero — unchanged contained layout. */}
      <header className="hidden flex-col gap-4 md:flex">
        {data.coverImageUrl ? (
          // Concentric radius: the card/page uses `rounded-lg` (14px); the
          // cover sits flush inside the header with no card padding around
          // it here, so it keeps the same 14px rather than a reduced one.
          <img
            src={data.coverImageUrl}
            alt=""
            className="h-72 w-full rounded-lg object-cover"
          />
        ) : (
          <CoverPlaceholder className="h-72 w-full rounded-lg" />
        )}

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

        <MetaLine data={data} />
        <TagRow data={data} />
      </header>
    </>
  )
}
