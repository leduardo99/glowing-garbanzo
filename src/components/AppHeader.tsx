import { Link } from '@tanstack/react-router'

import { UserMenu } from '#/components/navigation/UserMenu'
import LocaleSwitcher from '#/components/LocaleSwitcher'
import { m } from '#/paraglide/messages'

const navLinkClassName =
  'text-sm font-medium text-ink-soft transition-colors hover:text-ink data-[status=active]:text-mata'

/**
 * The wordmark's route glyph: two stops and a dashed leg between them —
 * the drawn-route signature at its smallest register (DESIGN.md §5 "The
 * Drawn Route"). Hand-authored (not `RouteSketch`) because at 20px a
 * generative meander turns to noise; this is the fixed, iconic form.
 */
function BrandGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 16"
      className="h-4 w-6 shrink-0"
    >
      <path
        d="M 4 12 C 9 12, 10 4, 20 4"
        fill="none"
        stroke="var(--amber)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.1 4.5"
      />
      <circle cx="4" cy="12" r="3" fill="var(--mata)" />
      <circle cx="20" cy="4" r="2.4" fill="none" stroke="var(--mata)" strokeWidth="1.8" />
    </svg>
  )
}

/**
 * Site header. Desktop (`md:` and up) carries the wordmark, primary nav
 * links, locale switcher, and the session-dependent account area
 * (`UserMenu`). On mobile the primary nav and account area move to
 * `BottomNav` (the native-feeling bottom tab bar), so the header shrinks
 * to just the wordmark and locale switcher — DESIGN.md's "header
 * simplified on mobile" rule.
 *
 * Surface background with a Line-strong bottom border and no shadow, per
 * DESIGN.md's Navigation section — chrome, not a lifted card. The wordmark
 * stays in Karla (navigation is chrome, not content) but carries the route
 * glyph, the one place brand identity lives in the chrome.
 */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line-strong bg-surface px-4 py-3 md:px-6">
      <Link
        to="/"
        className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight text-ink"
      >
        <BrandGlyph />
        {m.app_name()}
      </Link>

      <nav
        aria-label={m.nav_primary_label()}
        className="hidden items-center gap-6 md:flex"
      >
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className={navLinkClassName}
        >
          {m.nav_home()}
        </Link>
        <Link to="/my" className={navLinkClassName}>
          {m.nav_my_itineraries()}
        </Link>
      </nav>

      <div className="flex items-center gap-3 md:gap-4">
        <LocaleSwitcher />
        <div className="hidden md:block">
          <UserMenu variant="header" />
        </div>
      </div>
    </header>
  )
}
