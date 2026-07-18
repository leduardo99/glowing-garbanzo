import { CalendarDaysIcon, StarIcon } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { m } from '#/paraglide/messages'
import type { ItineraryCard as ItineraryCardData } from '#/server/itineraries'

const MAX_VISIBLE_TAGS = 3

/**
 * Discovery grid card. Purely presentational (no routing) so it renders
 * without a router context in tests — the home route wraps it in a `Link`
 * to `/itineraries/$slug`.
 */
export function ItineraryCard({ item }: { item: ItineraryCardData }) {
  const visibleTags = item.tags.slice(0, MAX_VISIBLE_TAGS)

  return (
    <Card className="h-full gap-3 overflow-hidden py-0 transition-shadow hover:shadow-md">
      {item.coverImageUrl ? (
        <img
          src={item.coverImageUrl}
          alt=""
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="h-40 w-full bg-muted" aria-hidden="true" />
      )}

      <CardHeader className="pt-4">
        <CardTitle className="truncate">{item.title}</CardTitle>
        {item.destination ? (
          <CardDescription className="truncate">
            {item.destination}
          </CardDescription>
        ) : null}
      </CardHeader>

      {visibleTags.length > 0 ? (
        <CardContent className="flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </CardContent>
      ) : null}

      <CardFooter className="mt-auto flex items-center justify-between pb-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDaysIcon data-icon="inline-start" />
          {m.view_days_count({ count: item.dayCount })}
        </span>
        <span className="flex items-center gap-1">
          <StarIcon
            data-icon="inline-start"
            className="fill-current text-amber-500"
          />
          <span>{item.ratingAvg !== null ? item.ratingAvg.toFixed(1) : '—'}</span>
          <span>({item.ratingCount})</span>
        </span>
      </CardFooter>
    </Card>
  )
}
