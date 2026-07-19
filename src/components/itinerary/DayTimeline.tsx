import { useEffect, useRef, useState } from 'react'

import { StopList } from '#/components/StopList'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import type { DayView } from '#/server/itineraries'

/** Day tabs only earn their place once a trip is long enough to need jumping. */
const DAY_TABS_MIN_DAYS = 3

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
 *
 * Longer trips (≥3 days) get a sticky day-tab row: chips that anchor-jump
 * to each day. The timeline stays one continuous list (no content
 * swapping — deep links and reading flow survive); an IntersectionObserver
 * scroll-spy keeps the active chip in sync while scrolling.
 */
export function DayTimeline({ days }: { days: DayView[] }) {
  let sequence = 1
  const showTabs = days.length >= DAY_TABS_MIN_DAYS
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const dayRefs = useRef(new Map<number, HTMLLIElement>())
  const pinnedUntilRef = useRef(0)

  useEffect(() => {
    if (!showTabs) {
      return
    }
    // IO callbacks only carry the entries that *changed*, so the active
    // day is recomputed from every day's live position instead: the last
    // day whose top has passed the reading line (just under the sticky
    // tab row) is the one being read. The observer is just the trigger —
    // it fires exactly when any day crosses that line.
    const READING_LINE_PX = 120
    const update = () => {
      // A just-clicked tab stays active while its smooth scroll settles —
      // on short pages the target day may never reach the reading line,
      // and the spy overriding the click would read as a broken tab.
      if (Date.now() < pinnedUntilRef.current) {
        return
      }
      let current: number | null = null
      for (const [dayNumber, el] of dayRefs.current) {
        if (el.getBoundingClientRect().top <= READING_LINE_PX) {
          current = current === null ? dayNumber : Math.max(current, dayNumber)
        }
      }
      setActiveDay(current)
    }
    const observer = new IntersectionObserver(update, {
      rootMargin: `-${READING_LINE_PX}px 0px 0px 0px`,
      threshold: [0, 1],
    })
    for (const el of dayRefs.current.values()) {
      observer.observe(el)
    }
    update()
    return () => observer.disconnect()
  }, [showTabs, days.length])

  function jumpToDay(dayNumber: number) {
    setActiveDay(dayNumber)
    pinnedUntilRef.current = Date.now() + 900
    dayRefs.current
      .get(dayNumber)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-headline font-semibold text-ink">
        {m.view_days_title()}
      </h2>

      {showTabs ? (
        <nav
          aria-label={m.view_days_title()}
          className="no-scrollbar sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-line bg-paper/95 px-4 py-2 backdrop-blur-sm sm:mx-0 sm:px-0"
        >
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => jumpToDay(day.dayNumber)}
              aria-current={activeDay === day.dayNumber ? 'true' : undefined}
              className={cn(
                'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-label font-medium whitespace-nowrap transition-colors tabular-nums',
                activeDay === day.dayNumber
                  ? 'bg-mata-soft text-mata-soft-foreground'
                  : 'bg-surface-sunken text-ink-soft hover:text-ink',
              )}
            >
              {m.view_day_label({ number: day.dayNumber })}
            </button>
          ))}
        </nav>
      ) : null}

      <ol className="flex flex-col gap-8 border-l border-line py-2 pl-6 sm:pl-8">
        {days.map((day) => {
          const startSequence = sequence
          sequence += day.stops.length
          return (
            <li
              key={day.id}
              data-day-number={day.dayNumber}
              ref={(el) => {
                if (el) {
                  dayRefs.current.set(day.dayNumber, el)
                } else {
                  dayRefs.current.delete(day.dayNumber)
                }
              }}
              className="relative flex scroll-mt-16 flex-col gap-3"
            >
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
