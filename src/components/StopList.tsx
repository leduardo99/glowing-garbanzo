import {
  BedDoubleIcon,
  BusIcon,
  CircleDotIcon,
  LandmarkIcon,
  UtensilsIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { m } from '#/paraglide/messages'
import type { StopView } from '#/server/itineraries'

const CATEGORY_ICON: Record<StopView['category'], LucideIcon> = {
  attraction: LandmarkIcon,
  food: UtensilsIcon,
  lodging: BedDoubleIcon,
  transport: BusIcon,
  other: CircleDotIcon,
}

const CATEGORY_LABEL: Record<StopView['category'], () => string> = {
  attraction: m.stop_category_attraction,
  food: m.stop_category_food,
  lodging: m.stop_category_lodging,
  transport: m.stop_category_transport,
  other: m.stop_category_other,
}

const costFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/**
 * Read-only ordered list of a day's stops. Each stop's marker is the
 * numbered mata disc — the exact visual `ItineraryMap` uses for its pins
 * (DESIGN.md §5 "The Drawn Route": map and timeline are two views of the
 * same journey, so they share one numbering). `startSequence` is the
 * global 1-based number of this day's first stop, threaded in by
 * `DayTimeline` so numbering runs continuously across days.
 *
 * The category moved from the (former) icon disc into the meta row —
 * a small icon + label next to place/cost, where identification beats
 * decoration.
 */
export function StopList({
  stops,
  startSequence = 1,
}: {
  stops: StopView[]
  startSequence?: number
}) {
  return (
    <ol className="flex flex-col gap-4">
      {stops.map((stop, index) => {
        const Icon = CATEGORY_ICON[stop.category]
        return (
          <li key={stop.id} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-mata text-sm font-semibold tabular-nums text-primary-foreground"
            >
              {startSequence + index}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-title font-medium text-ink">
                {stop.name}
              </span>
              {stop.description ? (
                <span className="measure-prose text-body text-ink-soft">
                  {stop.description}
                </span>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption tabular-nums text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <Icon aria-hidden="true" className="size-3" />
                  {CATEGORY_LABEL[stop.category]()}
                </span>
                {stop.placeLabel ? <span>{stop.placeLabel}</span> : null}
                {stop.costCents !== null ? (
                  <span>
                    {m.view_cost_estimate({
                      amount: costFormatter.format(stop.costCents / 100),
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
