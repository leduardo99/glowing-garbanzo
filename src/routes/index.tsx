/**
 * The landing page — Roteiros' front door for anonymous visitors
 * (signed-in users are sent straight to `/explore`, the app home).
 *
 * Design spec: docs/superpowers/specs/2026-07-19-landing-redesign-journey-design.md.
 * The page is composed as a journey — it departs, travels, and arrives:
 *
 *   1. Departure — a drenched deep-mata fold (the brand's committed color
 *      moment, theme-invariant like AuthShell's panel) where the drawn
 *      route traces itself in over the headline.
 *   2. The journey — the community's real routes on a full-bleed live map,
 *      then the catalog's best trips on shelves.
 *   3. The waypoints — how-it-works as three numbered stops sitting on a
 *      literal dashed amber connector (a genuine ordered sequence).
 *   4. Arrival — the closing CTA under the ringed "you arrive here"
 *      destination mark, calm on paper.
 *
 * The landing lives outside the `_app` shell layout (no AppHeader/BottomNav);
 * the landing renders its own transparent header and a minimal footer.
 */
import { Suspense, lazy } from 'react'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'

import { BrandGlyph } from '#/components/AppHeader'
import { ItineraryCard } from '#/components/ItineraryCard'
import LocaleSwitcher from '#/components/LocaleSwitcher'
import { RouteSketch } from '#/components/RouteSketch'
import { SpecimenFrame } from '#/components/landing/SpecimenFrame'
import {
  AiSpecimen,
  CardSpecimen,
  ForkSpecimen,
  MapSpecimen,
  TimelineSpecimen,
} from '#/components/landing/specimens'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '#/components/ui/accordion'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'
import { getCommunityStats } from '#/server/community'
import { getLandingHighlights } from '#/server/landing'
import type { ItineraryCard as ItineraryCardData } from '#/server/itineraries'

// Lazy so `maplibre-gl` never loads when there are no geocoded routes to
// draw (the RouteSketch panel behind it carries the band instead).
const LandingMap = lazy(() => import('#/components/map/LandingMap'))

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    // The landing is a front door, not the app: signed-in travelers go
    // straight to discovery.
    if (context.session) {
      throw redirect({ to: '/explore' })
    }
  },
  loader: async () => {
    const [highlights, stats] = await Promise.all([
      getLandingHighlights(),
      getCommunityStats(),
    ])
    return { ...highlights, stats }
  },
  component: LandingPage,
})

/* The hero panel is theme-invariant (deep mata with cream ink in light AND
   dark, same as AuthShell's brand panel), so its ink is written as literal
   values rather than theme tokens. */
const CREAM = 'oklch(0.985 0.006 88)'
/* Full class strings (never composed with template prefixes) so Tailwind's
   scanner sees each literal candidate. The dark: doubles pin the hero's
   button surfaces against variant classes that assume a themed context. */
const creamText = 'text-[oklch(0.985_0.006_88)]'
const creamTextSoft = 'text-[oklch(0.985_0.006_88_/_0.78)]'
const creamTextHover = 'hover:text-[oklch(0.985_0.006_88)]'
const creamFillButton =
  'bg-[oklch(0.985_0.006_88)] text-[oklch(0.3_0.09_152)] hover:bg-[oklch(0.94_0.012_88)] hover:text-[oklch(0.3_0.09_152)]'
const creamGhostButton =
  'text-[oklch(0.985_0.006_88)] hover:bg-[oklch(0.985_0.006_88_/_0.12)] hover:text-[oklch(0.985_0.006_88)] dark:hover:bg-[oklch(0.985_0.006_88_/_0.12)]'
const creamOutlineButton =
  'border border-[oklch(0.985_0.006_88_/_0.4)] bg-transparent text-[oklch(0.985_0.006_88)] hover:bg-[oklch(0.985_0.006_88_/_0.1)] hover:text-[oklch(0.985_0.006_88)] dark:hover:bg-[oklch(0.985_0.006_88_/_0.1)]'

/** A short vertical dashed amber leg — the route leaving one section for the next. */
function DashedLeg({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 2 64"
      preserveAspectRatio="none"
      className={className}
    >
      <line
        x1="1"
        y1="2"
        x2="1"
        y2="62"
        stroke="var(--amber)"
        strokeWidth="2"
        strokeDasharray="0.5 7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LandingHeader() {
  return (
    <header className="relative z-10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 md:py-5">
        <Link
          to="/"
          className={`flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight ${creamText} ${creamTextHover}`}
        >
          <BrandGlyph tone="oncolor" />
          {m.app_name()}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/explore"
            className={`hidden px-3 text-label font-medium ${creamTextSoft} ${creamTextHover} md:block`}
          >
            {m.nav_explore()}
          </Link>
          <Button asChild variant="ghost" className={creamGhostButton}>
            <Link to="/login">{m.landing_cta_login()}</Link>
          </Button>
          <Button asChild className={creamFillButton}>
            <Link to="/signup">{m.landing_cta_signup()}</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}

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
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[1.5rem] text-ink">{title}</h2>
        <Link
          to="/explore"
          search={{ sort: seeAllSearch.sort, page: 1, duration: 'any' }}
          className="flex items-center gap-1 text-label font-medium whitespace-nowrap"
        >
          {m.landing_see_all()}
          <ArrowRightIcon aria-hidden="true" className="size-3.5" />
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
      {/*
        Departure. Theme-invariant deep mata (the mata-deep light token as a
        literal): the committed color moment the brand register asks for.
        The CSS-var overrides keep the amber/cream line-work tuned to the
        dark fill in both themes (RouteSketch oncolor + BrandGlyph oncolor
        + the base `a` color all read them).
      */}
      <section
        className="relative isolate flex min-h-[85svh] flex-col overflow-hidden"
        style={{
          backgroundColor: 'oklch(0.34 0.09 152)',
          ['--primary-foreground' as string]: CREAM,
          ['--amber' as string]: 'oklch(0.72 0.13 74)',
        }}
      >
        <LandingHeader />

        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pt-6 pb-20 sm:px-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-8 md:pb-24">
          <div className="flex max-w-2xl flex-col gap-5">
            <h1
              className={`animate-in fade-in slide-in-from-bottom-2 font-display fill-mode-both text-[clamp(2.5rem,6.5vw,5rem)] leading-[1.04] duration-700 ${creamText}`}
            >
              {m.landing_hero_title()}
            </h1>
            <p
              className={`animate-in fade-in slide-in-from-bottom-2 fill-mode-both max-w-[34rem] text-[1.0625rem] leading-relaxed duration-700 ${creamTextSoft}`}
              style={{ animationDelay: '120ms' }}
            >
              {m.landing_hero_subtitle()}
            </p>
            <div
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both mt-2 flex flex-wrap items-center gap-3 duration-700"
              style={{ animationDelay: '220ms' }}
            >
              <Button asChild size="lg" className={creamFillButton}>
                <Link to="/explore">{m.landing_cta_explore()}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className={creamOutlineButton}
              >
                <Link to="/signup">{m.landing_cta_signup()}</Link>
              </Button>
            </div>

            {data.stats.topDestinations.length > 0 ? (
              <div
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both mt-3 flex flex-wrap items-center gap-2 duration-700"
                style={{ animationDelay: '320ms' }}
              >
                <span className="text-caption text-[oklch(0.985_0.006_88_/_0.6)]">
                  {m.landing_destinations_label()}
                </span>
                {data.stats.topDestinations.map((d) => (
                  <Link
                    key={d.destination}
                    to="/explore"
                    search={{
                      q: d.destination,
                      sort: 'recent',
                      page: 1,
                      duration: 'any',
                    }}
                    className="rounded-full border border-[oklch(0.985_0.006_88_/_0.25)] px-3 py-1 text-caption text-[oklch(0.985_0.006_88_/_0.85)] hover:bg-[oklch(0.985_0.006_88_/_0.1)] hover:text-[oklch(0.985_0.006_88)]"
                  >
                    {d.destination}
                  </Link>
                ))}
              </div>
            ) : null}
            {data.stats.itineraryCount > 0 ? (
              <p
                className="animate-in fade-in fill-mode-both text-caption text-[oklch(0.985_0.006_88_/_0.6)] duration-700 tabular-nums"
                style={{ animationDelay: '400ms' }}
              >
                {m.landing_social_proof({
                  itineraries: data.stats.itineraryCount,
                  destinations: data.stats.destinationCount,
                })}
              </p>
            ) : null}
          </div>

          {/* The product as the hero imagery (Travelora move): real
              components, light-pinned, floating over the drawn route —
              which still traces itself in behind them. */}
          <div className="relative mx-auto mt-4 w-full max-w-[24rem] pb-10 md:mt-0 md:max-w-[26rem]">
            <RouteSketch
              seed="landing-hero"
              stops={5}
              animated
              tone="oncolor"
              className="absolute -top-12 -left-6 w-full opacity-70"
            />
            <SpecimenFrame className="relative">
              <CardSpecimen className="w-52 rotate-[-2deg] sm:w-60" />
              <TimelineSpecimen className="absolute top-20 -right-1 w-52 rotate-[1.5deg] sm:w-56" />
              <MapSpecimen className="absolute -bottom-8 left-2 hidden h-24 w-40 rotate-[2deg] sm:block" />
            </SpecimenFrame>
          </div>
        </div>

        {/* The route continues below the fold — a dashed leg exits the
            hero exactly where the arrival section's lead-in resumes it. */}
        <DashedLeg className="absolute bottom-0 left-1/2 h-14 w-0.5 -translate-x-1/2" />
      </section>

      {/*
        Feature bands (Trippin's storytelling, our material): what the
        product does, each band showing a real product fragment — no
        mascots, no scene illustration. Alternating sides for rhythm.
      */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 py-16 sm:px-6 md:gap-20 md:py-24">
        <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] text-ink">
          {m.landing_features_title()}
        </h2>

        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className="flex max-w-md flex-col gap-3">
            <h3 className="font-display text-[1.4rem] leading-snug text-ink">
              {m.landing_feature_ai_title()}
            </h3>
            <p className="measure-prose text-body text-ink-soft">
              {m.landing_feature_ai_description()}
            </p>
          </div>
          <SpecimenFrame className="mx-auto w-full max-w-[22rem]">
            <AiSpecimen />
          </SpecimenFrame>
        </div>

        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className="flex max-w-md flex-col gap-3 md:order-2">
            <h3 className="font-display text-[1.4rem] leading-snug text-ink">
              {m.landing_feature_fork_title()}
            </h3>
            <p className="measure-prose text-body text-ink-soft">
              {m.landing_feature_fork_description()}
            </p>
          </div>
          <SpecimenFrame className="mx-auto w-full max-w-[17rem] md:order-1">
            <ForkSpecimen />
          </SpecimenFrame>
        </div>

        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className="flex max-w-md flex-col gap-3">
            <h3 className="font-display text-[1.4rem] leading-snug text-ink">
              {m.landing_feature_map_title()}
            </h3>
            <p className="measure-prose text-body text-ink-soft">
              {m.landing_feature_map_description()}
            </p>
          </div>
          <SpecimenFrame className="mx-auto flex w-full max-w-[24rem] items-start gap-3">
            <MapSpecimen className="h-36 flex-1" />
            <TimelineSpecimen className="w-48 shrink-0" />
          </SpecimenFrame>
        </div>
      </section>

      {/*
        The journey, part one: every published route, drawn on one map.
        Full-bleed band — the map runs edge to edge with hairline borders,
        no card box. Behind it, the sketch keeps the band alive if WebGL
        (or the tile server) can't.
      */}
      {data.mapRoutes.length > 0 ? (
        <section>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-14 pb-8 sm:px-6 md:pt-20">
            <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] text-ink">
              {m.landing_routes_title()}
            </h2>
            <p className="measure-prose text-body text-ink-soft">
              {m.landing_routes_intro()}
            </p>
          </div>
          <div className="relative h-[56svh] min-h-[22rem] w-full overflow-hidden border-y border-line bg-mata-soft">
            <div className="absolute inset-0 flex items-center justify-center">
              <RouteSketch seed="landing-hero" stops={5} className="h-2/3 w-2/3 opacity-80" />
            </div>
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
            <p className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full bg-paper/90 px-3.5 py-1.5 text-caption text-ink shadow-resting backdrop-blur-sm">
              {m.landing_map_chip()}
            </p>
          </div>
        </section>
      ) : null}

      {/* The journey, part two: the catalog's best, same cards as /explore. */}
      {data.topRated.length > 0 || data.mostViewed.length > 0 ? (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 py-16 sm:px-6 md:py-20">
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
        </section>
      ) : null}

      {/*
        The waypoints: a genuine ordered sequence (find → fork → travel),
        drawn as three stops on one dashed amber connector — horizontal
        through the disc row on desktop, a vertical spine on mobile (the
        DayTimeline grammar). The last stop is the outlined destination.
      */}
      <section className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 md:py-24">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] text-ink">
            {m.landing_how_title()}
          </h2>
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {/* Desktop connector: first disc center to last disc center. */}
            <svg
              aria-hidden="true"
              className="absolute top-5 left-5 hidden h-0.5 w-[calc(66.666%+1.25rem)] md:block"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke="var(--amber)"
                strokeWidth="2"
                strokeDasharray="0.5 8"
                strokeLinecap="round"
              />
            </svg>
            {HOW_IT_WORKS.map((step, index) => {
              const isLast = index === HOW_IT_WORKS.length - 1
              return (
                <li key={index} className="relative flex gap-5 md:flex-col md:gap-4">
                  {/* Mobile connector: disc bottom down into the next stop. */}
                  {!isLast ? (
                    <svg
                      aria-hidden="true"
                      className="absolute top-12 -bottom-9 left-[19px] w-0.5 md:hidden"
                      preserveAspectRatio="none"
                    >
                      <line
                        x1="1"
                        y1="0"
                        x2="1"
                        y2="100%"
                        stroke="var(--amber)"
                        strokeWidth="2"
                        strokeDasharray="0.5 8"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-semibold tabular-nums ${
                      isLast
                        ? 'border-2 border-mata bg-paper text-mata'
                        : 'bg-mata text-primary-foreground'
                    }`}
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
              )
            })}
          </ol>
        </div>
      </section>

      {/* FAQ — the practical questions a first-time visitor actually has. */}
      <section className="border-t border-line">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 md:py-20">
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] text-ink">
            {m.landing_faq_title()}
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {[
              { id: 'free', q: m.landing_faq_free_q, a: m.landing_faq_free_a },
              { id: 'fork', q: m.landing_faq_fork_q, a: m.landing_faq_fork_a },
              {
                id: 'private',
                q: m.landing_faq_private_q,
                a: m.landing_faq_private_a,
              },
              { id: 'ai', q: m.landing_faq_ai_q, a: m.landing_faq_ai_a },
            ].map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="text-title font-semibold text-ink">
                  {item.q()}
                </AccordionTrigger>
                <AccordionContent className="measure-prose text-body text-ink-soft">
                  {item.a()}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/*
        Arrival. The route that left the hero lands here: a dashed lead-in
        descending into the ringed "you arrive here" mark (RouteSketch's
        destination glyph), then the invitation. Calm, on paper — the hero
        owns the drenched moment.
      */}
      <section className="flex flex-col items-center gap-6 px-4 pt-4 pb-24 text-center sm:px-6 md:pb-28">
        <DashedLeg className="h-16 w-0.5" />
        <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8">
          <circle cx="16" cy="16" r="11" fill="none" stroke="var(--mata)" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="4.5" fill="var(--mata)" />
        </svg>
        <h2 className="max-w-2xl font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.12] text-ink">
          {m.landing_closing_title()}
        </h2>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/signup">{m.landing_cta_signup()}</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link to="/login">{m.landing_cta_login()}</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <BrandGlyph />
            <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
              {m.app_name()}
            </span>
            <span className="text-caption text-ink-soft">
              {m.footer_tagline()}
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-5">
            <Link to="/explore" className="text-label font-medium">
              {m.nav_explore()}
            </Link>
            <Link to="/login" className="text-label font-medium">
              {m.landing_cta_login()}
            </Link>
            <Link to="/signup" className="text-label font-medium">
              {m.landing_cta_signup()}
            </Link>
          </nav>
          <LocaleSwitcher />
        </div>
      </footer>
    </div>
  )
}
