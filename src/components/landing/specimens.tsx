/**
 * Hand-composed product specimens for the marketing surfaces (Travelora's
 * "the product is the imagery", in our own material): a real
 * `ItineraryCard` with fixture data, a compact day-timeline fragment, and
 * a mini map panel. Always wrapped in `SpecimenFrame` (light-pinned,
 * aria-hidden) by the caller. Fixture copy comes from messages so both
 * locales read naturally.
 */
import { CalendarDaysIcon, GitForkIcon, SparklesIcon, StarIcon } from 'lucide-react'

import { ItineraryCard } from '#/components/ItineraryCard'
import { RouteSketch } from '#/components/RouteSketch'
import { m } from '#/paraglide/messages'
import type { ItineraryCard as ItineraryCardData } from '#/server/itineraries'

export function cardFixture(): ItineraryCardData {
  return {
    id: 'specimen-card',
    slug: 'specimen-rio',
    title: m.specimen_card_title(),
    destination: m.specimen_card_destination(),
    summary: null,
    tags: [m.specimen_tag_beach(), m.specimen_tag_food()],
    coverImageUrl: null,
    ratingAvg: 4.8,
    ratingCount: 12,
    dayCount: 3,
    costTotalCents: 68000,
    currency: 'BRL',
    publishedAt: null,
  }
}

export function CardSpecimen({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ItineraryCard item={cardFixture()} />
    </div>
  )
}

/** A day header + three stops off the timeline — the product's signature list view, condensed. */
export function TimelineSpecimen({ className }: { className?: string }) {
  const stops = [
    { n: 4, name: m.specimen_stop_1(), time: '09:30' },
    { n: 5, name: m.specimen_stop_2(), time: '12:00' },
    { n: 6, name: m.specimen_stop_3(), time: '17:45' },
  ]
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-lifted ${className ?? ''}`}
    >
      <p className="font-display text-[1.05rem] leading-tight text-ink">
        {m.specimen_day_title()}
      </p>
      <ul className="flex flex-col gap-2.5">
        {stops.map((stop) => (
          <li key={stop.n} className="flex items-center gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mata text-[11px] font-semibold text-primary-foreground tabular-nums">
              {stop.n}
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">
              {stop.name}
            </span>
            <span className="text-[0.6875rem] text-ink-soft tabular-nums">
              {stop.time}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The AI flow, condensed: a prompt in the app's sunken-input material → two drafted day rows. */
export function AiSpecimen({ className }: { className?: string }) {
  const days = [m.specimen_ai_day1(), m.specimen_ai_day2()]
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-lifted ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 rounded-sm bg-surface-sunken px-3 py-2.5">
        <SparklesIcon aria-hidden="true" className="size-3.5 shrink-0 text-mata" />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">
          {m.specimen_ai_prompt()}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {days.map((day, index) => (
          <li key={index} className="flex items-center gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mata text-[11px] font-semibold text-primary-foreground tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-[0.875rem] text-ink">
              {day}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The card specimen with the fork lineage badge — "someone went, you continue". */
export function ForkSpecimen({ className }: { className?: string }) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <ItineraryCard item={cardFixture()} />
      <span className="absolute -top-2.5 left-3 flex items-center gap-1 rounded-full bg-mata px-2.5 py-1 text-[0.6875rem] font-semibold text-primary-foreground shadow-lifted">
        <GitForkIcon aria-hidden="true" className="size-3" />
        {m.specimen_fork_badge()}
      </span>
    </div>
  )
}

/** The map register: a sketch-route panel with the app's floating badge chips. */
export function MapSpecimen({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-mata-soft shadow-lifted ${className ?? ''}`}
    >
      <RouteSketch
        seed="specimen-map"
        stops={4}
        numbered
        className="h-full w-full p-4"
      />
      <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-paper/90 px-2 py-0.5 text-[0.6875rem] font-medium text-ink shadow-resting">
        <CalendarDaysIcon aria-hidden="true" className="size-3" />
        <span className="tabular-nums">3</span>
      </span>
      <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-paper/90 px-2 py-0.5 text-[0.6875rem] font-medium text-ink shadow-resting">
        <StarIcon aria-hidden="true" className="size-3 fill-current text-amber" />
        <span className="tabular-nums">4.8</span>
      </span>
    </div>
  )
}
