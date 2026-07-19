import { Link } from '@tanstack/react-router'

import LocaleSwitcher from '#/components/LocaleSwitcher'
import { SpecimenFrame } from '#/components/landing/SpecimenFrame'
import { TimelineSpecimen } from '#/components/landing/specimens'
import { RouteSketch } from '#/components/RouteSketch'
import { m } from '#/paraglide/messages'
import type { CommunityStats } from '#/server/community'

/**
 * Dedicated split-screen shell for the auth pages (`/login`, `/signup`,
 * `/forgot-password`, `/reset-password`). The app chrome hides itself on
 * these routes (chromeless.ts), so the page owns the whole viewport —
 * which is why the LocaleSwitcher lives here (BonSanté reference): with
 * the header gone this is a visitor's only way to switch language.
 *
 * Desktop (lg+): a deep-mata brand panel — deliberately theme-invariant
 * (deep forest green with cream ink in light AND dark; the CSS-variable
 * overrides keep RouteSketch's `oncolor` dots cream in both themes) —
 * carrying the wordmark, positioning copy, a floating product specimen
 * (the product, live — not an abstract promise), and real community
 * numbers when provided.
 *
 * Mobile: a compact brand header (sketch + wordmark) above the form —
 * full-height so the keyboard can open without scrolling the brand away.
 */
export function AuthShell({
  welcome,
  stats,
  children,
  footer,
}: {
  welcome: string
  /** Community numbers for the brand panel; omitted → the line simply doesn't render. */
  stats?: CommunityStats
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside
        className="relative hidden flex-col justify-between gap-10 overflow-hidden p-10 lg:flex xl:p-14"
        style={{
          backgroundColor: 'oklch(0.34 0.09 152)',
          // Theme-invariant panel ink (see doc comment).
          ['--primary-foreground' as string]: 'oklch(0.985 0.006 88)',
          ['--amber' as string]: 'oklch(0.72 0.13 74)',
        }}
      >
        <Link
          to="/"
          className="w-fit font-semibold tracking-tight text-[oklch(0.985_0.006_88)]"
        >
          {m.app_name()}
        </Link>

        <div className="flex max-w-md flex-col gap-6">
          <div className="flex flex-col gap-4">
            <p className="font-display text-[clamp(1.75rem,2.5vw,2.5rem)] leading-[1.12] text-[oklch(0.985_0.006_88)]">
              {m.auth_panel_tagline()}
            </p>
            <p className="text-body text-[oklch(0.985_0.006_88_/_0.75)]">
              {m.auth_panel_description()}
            </p>
          </div>

          {/* The product, live: a floating specimen instead of an abstract
              mark — pinned to the light theme so it reads as the app
              itself resting on the panel. */}
          <SpecimenFrame className="max-w-[300px] rotate-[-1.5deg]">
            <TimelineSpecimen />
          </SpecimenFrame>

          {stats && stats.itineraryCount > 0 ? (
            <p className="text-caption text-[oklch(0.985_0.006_88_/_0.7)] tabular-nums">
              {m.auth_panel_stats({
                itineraries: stats.itineraryCount,
                destinations: stats.destinationCount,
              })}
            </p>
          ) : null}
        </div>

        <RouteSketch
          seed="roteiros-brand"
          stops={4}
          tone="oncolor"
          className="h-24 w-full max-w-xs opacity-80"
        />
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <LocaleSwitcher />
        </div>
        <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <RouteSketch
              seed="roteiros-brand"
              stops={3}
              className="h-12 w-24 lg:hidden"
            />
            <Link to="/" className="w-fit self-center">
              <h1 className="font-display text-display text-ink">
                {m.app_name()}
              </h1>
            </Link>
            <p className="text-body text-ink-soft">{welcome}</p>
          </div>

          {children}

          <div className="mt-6 text-center">{footer}</div>
        </div>
      </main>
    </div>
  )
}
