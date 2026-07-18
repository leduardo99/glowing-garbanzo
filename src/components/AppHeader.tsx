import { Link } from '@tanstack/react-router'

import { UserMenu } from '#/components/navigation/UserMenu'
import LocaleSwitcher from '#/components/LocaleSwitcher'
import { m } from '#/paraglide/messages'

const navLinkClassName =
  'text-sm font-medium text-ink-soft transition-colors hover:text-ink data-[status=active]:text-terracotta'

/**
 * Site header. Desktop (`md:` and up) carries the wordmark, primary nav
 * links, locale switcher, and the session-dependent account area
 * (`UserMenu`). On mobile the primary nav and account area move to
 * `BottomNav` (the native-feeling bottom tab bar), so the header shrinks
 * to just the wordmark and locale switcher — DESIGN.md's "header
 * simplified on mobile" rule.
 *
 * Surface background with a Line-strong bottom border and no shadow, per
 * DESIGN.md's Navigation section — chrome, not a lifted card.
 */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line-strong bg-surface px-4 py-3 md:px-6">
      <Link
        to="/"
        className="text-[0.9375rem] font-semibold tracking-tight text-ink"
      >
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
