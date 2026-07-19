import { Link } from '@tanstack/react-router'

import { RouteSketch } from '#/components/RouteSketch'
import { m } from '#/paraglide/messages'

/**
 * Dedicated split-screen shell for `/login` and `/signup` (design spec:
 * docs/superpowers/specs/2026-07-19-landing-auth-restructure-design.md).
 * The app chrome (header, bottom tabs) hides itself on these routes — see
 * AppHeader/BottomNav — so the page owns the whole viewport.
 *
 * Desktop (lg+): a deep-mata brand panel (wordmark, positioning copy, the
 * drawn-route mark) beside the form column. The panel is deliberately
 * theme-invariant — deep forest green with cream ink in light AND dark —
 * so the brand moment doesn't flip to a bright leaf panel at night; the
 * CSS-variable overrides on the panel keep `RouteSketch`'s `oncolor` dots
 * cream in both themes.
 *
 * Mobile: a compact brand header (sketch + wordmark) above the form —
 * full-height so the keyboard can open without scrolling the brand away.
 */
export function AuthShell({
  welcome,
  children,
  footer,
}: {
  welcome: string
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

        <div className="flex max-w-md flex-col gap-4">
          <p className="font-display text-[clamp(1.75rem,2.5vw,2.5rem)] leading-[1.12] text-[oklch(0.985_0.006_88)]">
            {m.auth_panel_tagline()}
          </p>
          <p className="text-body text-[oklch(0.985_0.006_88_/_0.75)]">
            {m.auth_panel_description()}
          </p>
        </div>

        <RouteSketch
          seed="roteiros-brand"
          stops={4}
          tone="oncolor"
          className="h-36 w-full max-w-sm opacity-90"
        />
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-6">
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
