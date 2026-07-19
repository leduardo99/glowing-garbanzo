/**
 * The landing page — Roteiros' front door for anonymous visitors
 * (signed-in users are sent straight to `/explore`, the app home).
 *
 * Design spec: docs/superpowers/specs/2026-07-19-landing-auth-restructure-design.md.
 * The hero imagery is the product itself: a live map with the community's
 * published routes drawn in the app's signature (amber dashed lines, mata
 * dots). Shelves below surface the catalog's best (top rated / most
 * viewed) with the same cards the discovery grid uses; the how-it-works
 * sequence reuses the numbered-disc language of the stop timeline — a
 * genuine ordered flow, not decorative numbering.
 */
import { Suspense, lazy } from 'react'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'

import { ItineraryCard } from '#/components/ItineraryCard'
import { RouteSketch } from '#/components/RouteSketch'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'
import { getLandingHighlights } from '#/server/landing'
import type { ItineraryCard as ItineraryCardData } from '#/server/itineraries'

// Lazy so `maplibre-gl` never loads when there are no geocoded routes to
// draw (the RouteSketch panel behind it carries the hero instead).
const LandingMap = lazy(() => import('#/components/map/LandingMap'))

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    // The landing is a front door, not the app: signed-in travelers go
    // straight to discovery.
    if (context.session) {
      throw redirect({ to: '/explore' })
    }
  },
  loader: () => getLandingHighlights(),
  component: LandingPage,
})

function CardShelf({
  title,
  items,
  seeAllSearch,
}: {
  title: string
  items: ItineraryCardData[]
  seeAllSearch: { sort: 'recent' | 'top' }
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-headline font-semibold text-ink">{title}</h2>
        <Link
          to="/explore"
          search={{ sort: seeAllSearch.sort, page: 1, duration: 'any' }}
          className="text-label font-medium whitespace-nowrap"
        >
          {m.landing_see_all()}
        </Link>
      </div>
      {/* Mobile: swipeable shelf with snap; desktop: plain grid. */}
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/itineraries/$slug"
            params={{ slug: item.slug }}
            viewTransition={{ types: ['nav-forward'] }}
            className="w-64 shrink-0 snap-start sm:w-auto"
          >
            <ItineraryCard item={item} />
          </Link>
        ))}
      </div>
    </section>
  )
}

const HOW_IT_WORKS = [
  { title: m.landing_how_find_title, description: m.landing_how_find_description },
  { title: m.landing_how_fork_title, description: m.landing_how_fork_description },
  { title: m.landing_how_adjust_title, description: m.landing_how_adjust_description },
]

function LandingPage() {
  const data = Route.useLoaderData()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col">
      {/* Hero: one idea per fold — the community's routes, on a real map. */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-10 pb-14 sm:px-6 md:gap-10 md:pt-16">
        <div className="flex max-w-2xl flex-col gap-4">
          <h1 className="font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.05] tracking-[-0.02em] text-ink">
            {m.landing_hero_title()}
          </h1>
          <p className="measure-prose text-body text-ink-soft sm:text-[1.0625rem]">
            {m.landing_hero_subtitle()}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/explore">{m.landing_cta_explore()}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/signup">{m.landing_cta_signup()}</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/*
            The map stacks over the RouteSketch panel: when MapLibre renders
            it covers the sketch; with no geocoded routes (or no WebGL) the
            sketch stays visible and the hero still carries the signature.
          */}
          <div className="relative h-[22rem] overflow-hidden rounded-xl bg-mata-soft shadow-lifted sm:h-[26rem] md:h-[30rem]">
            <div className="absolute inset-0 flex items-center justify-center">
              <RouteSketch seed="landing-hero" stops={5} className="h-2/3 w-2/3 opacity-80" />
            </div>
            {data.mapRoutes.length > 0 ? (
              <Suspense fallback={null}>
                <div className="absolute inset-0">
                  <LandingMap
                    routes={data.mapRoutes}
                    onOpenRoute={(slug) =>
                      void navigate({
                        to: '/itineraries/$slug',
                        params: { slug },
                        viewTransition: { types: ['nav-forward'] },
                      })
                    }
                  />
                </div>
              </Suspense>
            ) : null}
          </div>
          {data.mapRoutes.length > 0 ? (
            <p className="text-caption text-ink-soft">{m.landing_map_hint()}</p>
          ) : null}
        </div>
      </section>

      {/* Catalog shelves — rendered only when they have data. */}
      {data.topRated.length > 0 || data.mostViewed.length > 0 ? (
        <section className="border-t border-line bg-surface/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-14 sm:px-6">
            <CardShelf
              title={m.landing_top_rated()}
              items={data.topRated}
              seeAllSearch={{ sort: 'top' }}
            />
            <CardShelf
              title={m.landing_most_viewed()}
              items={data.mostViewed}
              seeAllSearch={{ sort: 'recent' }}
            />
          </div>
        </section>
      ) : null}

      {/* How it works — a real 3-step sequence, numbered with the same
          discs the stop timeline and map pins use. */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6">
        <h2 className="text-headline font-semibold text-ink">
          {m.landing_how_title()}
        </h2>
        <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={index} className="flex gap-4 md:flex-col">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mata text-sm font-semibold tabular-nums text-primary-foreground"
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-title font-semibold text-ink">
                  {step.title()}
                </h3>
                <p className="measure-prose text-body text-ink-soft">
                  {step.description()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA: the landing's one committed color moment — a deep
          mata band, cream type, inverted button. */}
      <section className="bg-mata">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between md:py-16">
          <h2 className="max-w-xl font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] text-primary-foreground">
            {m.landing_closing_title()}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-primary-foreground text-mata hover:bg-primary-foreground/90 dark:text-paper"
            >
              <Link to="/signup">{m.landing_cta_signup()}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/login">{m.landing_cta_login()}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
