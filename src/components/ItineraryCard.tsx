import { CalendarDaysIcon, StarIcon } from 'lucide-react'

import { CoverPlaceholder } from '#/components/CoverPlaceholder'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import { m } from '#/paraglide/messages'
import type { ItineraryCard as ItineraryCardData } from '#/server/itineraries'

const MAX_VISIBLE_TAGS = 3

/**
 * Discovery grid card — content-first, app-feed style (Uber Eats/Glovo
 * reference): a full-bleed cover fills the entire top of the card with
 * compact rating/day badges floating on it, title and destination sit in a
 * tight text block below rather than on a gradient scrim (keeps contrast
 * predictable across arbitrary user photos). Purely presentational (no
 * routing) so it renders without a router context in tests — the home
 * route wraps it in a `Link` to `/itineraries/$slug`. Shadow-only elevation
 * (DESIGN.md's Quiet Lift Rule): Resting at rest, Lifted on hover, never a
 * border.
 */
export function ItineraryCard({ item }: { item: ItineraryCardData }) {
  const visibleTags = item.tags.slice(0, MAX_VISIBLE_TAGS)

  return (
    <Card className="h-full gap-0 overflow-hidden border-0 py-0 shadow-resting transition-shadow hover:shadow-lifted">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden">
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <CoverPlaceholder seed={item.slug} className="h-full w-full" />
        )}

        <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-1">
          <Badge
            aria-label={m.view_days_count({ count: item.dayCount })}
            className="gap-1 border-0 bg-paper/90 text-ink shadow-resting backdrop-blur-sm"
          >
            <CalendarDaysIcon
              data-icon="inline-start"
              aria-hidden="true"
              className="size-3 shrink-0"
            />
            <span aria-hidden="true" className="tabular-nums">
              {item.dayCount}
            </span>
          </Badge>
          <Badge
            aria-label={
              item.ratingAvg !== null
                ? `${item.ratingAvg.toFixed(1)} · ${m.view_rating_count({ count: item.ratingCount })}`
                : m.view_no_ratings()
            }
            className="gap-1 border-0 bg-paper/90 text-ink shadow-resting backdrop-blur-sm"
          >
            <StarIcon
              aria-hidden="true"
              className="size-3 shrink-0 fill-current text-amber"
            />
            <span aria-hidden="true" className="tabular-nums">
              {item.ratingAvg !== null ? item.ratingAvg.toFixed(1) : '—'}
            </span>
          </Badge>
        </div>
      </div>

      <CardContent className="flex flex-col gap-1.5 p-3">
        <h3 className="truncate font-display text-title text-ink">
          {item.title}
        </h3>
        {item.destination ? (
          <p className="truncate text-label text-ink-soft">
            {item.destination}
          </p>
        ) : null}

        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {visibleTags.map((tag) => (
              <Badge key={tag} variant="tag">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
