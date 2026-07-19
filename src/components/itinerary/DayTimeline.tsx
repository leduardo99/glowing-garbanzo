import { StopList } from '#/components/StopList'
import { m } from '#/paraglide/messages'
import type { DayView } from '#/server/itineraries'

/**
 * The "logbook spine" — DESIGN.md's one structural element unique to
 * Roteiros: a thin `line`-colored rule runs down the left edge, each day
 * breaks it with a marker, and its stops sit underneath as quiet rows
 * (never boxed as a nested card — see `StopList`).
 *
 * Stop numbering runs continuously across the whole trip and matches the
 * map's numbered pins exactly (`collectMapStops` counts the same way) —
 * the drawn-route signature's rule that map and timeline are two views of
 * one journey.
 */
export function DayTimeline({ days }: { days: DayView[] }) {
  let sequence = 1

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-headline font-semibold text-ink">
        {m.view_days_title()}
      </h2>
      <ol className="flex flex-col gap-8 border-l border-line py-2 pl-6 sm:pl-8">
        {days.map((day) => {
          const startSequence = sequence
          sequence += day.stops.length
          return (
            <li key={day.id} className="relative flex flex-col gap-3">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[29px] size-2.5 rounded-full bg-mata sm:-left-[37px]"
              />
              <h3 className="flex items-baseline gap-2 font-display text-headline text-ink">
                <span>{m.view_day_label({ number: day.dayNumber })}</span>
                {day.title ? (
                  <span className="text-title font-normal text-ink-soft">
                    {day.title}
                  </span>
                ) : null}
              </h3>
              {day.note ? (
                <p className="measure-prose text-body text-ink-soft">
                  {day.note}
                </p>
              ) : null}
              {day.stops.length > 0 ? (
                <StopList stops={day.stops} startSequence={startSequence} />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
