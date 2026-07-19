import { Link } from '@tanstack/react-router'
import { BookOpenIcon, HomeIcon, PlusCircleIcon } from 'lucide-react'

import { UserMenu } from '#/components/navigation/UserMenu'
import {
  tabIconClassName,
  tabLinkClassName,
} from '#/components/navigation/tabLinkClassName'
import { m } from '#/paraglide/messages'

/**
 * Fixed bottom tab bar — the primary navigation surface on mobile
 * (`md:hidden`; `AppHeader` carries desktop nav instead). Four uniform
 * tabs (Chrome-style, per author feedback): Home, My itineraries, New,
 * Profile — every tab is the same 24px icon box + 11px label, stretched
 * to the same 64px row, so all four share one optical baseline. No
 * floating FAB: the earlier half-raised "+" circle overlapped page
 * content (pagination) and broke the row's symmetry.
 *
 * Active-tab treatment (DESIGN.md §5 Navigation): mata text plus a soft
 * mata pill behind the icon — the Material-3/native pattern, driven purely
 * by the Link's `data-status` via the `group` classes in
 * `tabLinkClassName.ts`.
 *
 * Box model: the bar is a fixed `4rem` (64px) content row plus
 * `env(safe-area-inset-bottom)` — `h-[calc(4rem+env(...))]` on the `<nav>`
 * with a matching `pb-[env(...)]` keeps the content row exactly 64px
 * regardless of device inset. `items-stretch` stretches all four items;
 * each centers its own icon+label. Targets stay ≥44px.
 *
 * The "New" and "My itineraries" destinations (`/new`, `/my`) redirect
 * anonymous visitors to `/login` in their own route `beforeLoad` guards —
 * this component doesn't duplicate that auth check, it just links there.
 */
export function BottomNav() {
  return (
    <nav
      aria-label={m.nav_primary_label()}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch border-t border-line-strong bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Link to="/explore" className={tabLinkClassName}>
        <span className={tabIconClassName}>
          <HomeIcon className="size-6" aria-hidden="true" />
        </span>
        <span className="text-[11px] font-medium">{m.nav_home()}</span>
      </Link>

      <Link to="/my" className={tabLinkClassName}>
        <span className={tabIconClassName}>
          <BookOpenIcon className="size-6" aria-hidden="true" />
        </span>
        <span className="text-[11px] font-medium">
          {m.nav_my_itineraries()}
        </span>
      </Link>

      <Link to="/new" className={tabLinkClassName}>
        <span className={tabIconClassName}>
          <PlusCircleIcon className="size-6" aria-hidden="true" />
        </span>
        <span className="text-[11px] font-medium">{m.nav_new_short()}</span>
      </Link>

      <UserMenu variant="tab" />
    </nav>
  )
}
