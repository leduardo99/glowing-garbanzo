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

/** Read-only ordered list of a day's stops: category icon, name, tip, cost, place. */
export function StopList({ stops }: { stops: StopView[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {stops.map((stop) => {
        const Icon = CATEGORY_ICON[stop.category]
        return (
          <li key={stop.id} className="flex gap-3">
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
              title={CATEGORY_LABEL[stop.category]()}
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{stop.name}</span>
              {stop.description ? (
                <span className="text-sm text-muted-foreground">
                  {stop.description}
                </span>
              ) : null}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
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
