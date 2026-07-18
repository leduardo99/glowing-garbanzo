import { Link } from '@tanstack/react-router'
import { BookOpenIcon, HomeIcon, PlusIcon } from 'lucide-react'

import { UserMenu } from '#/components/navigation/UserMenu'
import { m } from '#/paraglide/messages'

const tabLinkClassName =
  'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-ink-soft data-[status=active]:text-terracotta'

/**
 * Fixed bottom tab bar — the primary navigation surface on mobile
 * (`md:hidden`; `AppHeader` carries desktop nav instead). Four tabs per
 * DESIGN.md's Navigation section: Home/Search, My itineraries, New
 * (elevated pill CTA), Profile. All targets are ≥44px and the bar honors
 * `env(safe-area-inset-bottom)` for devices with a home indicator.
 *
 * The "New" and "My itineraries" destinations (`/new`, `/my`) redirect
 * anonymous visitors to `/login` in their own route `beforeLoad` guards —
 * this component doesn't duplicate that auth check, it just links there.
 */
export function BottomNav() {
  return (
    <nav
      aria-label={m.nav_primary_label()}
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line-strong bg-surface px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <Link to="/" activeOptions={{ exact: true }} className={tabLinkClassName}>
        <HomeIcon className="size-5" aria-hidden="true" />
        <span className="text-[11px] font-medium">{m.nav_home()}</span>
      </Link>

      <Link to="/my" className={tabLinkClassName}>
        <BookOpenIcon className="size-5" aria-hidden="true" />
        <span className="text-[11px] font-medium">
          {m.nav_my_itineraries()}
        </span>
      </Link>

      <Link
        to="/new"
        className="flex flex-1 flex-col items-center justify-center"
        aria-label={m.nav_new_itinerary()}
      >
        <span className="flex size-11 -translate-y-2 items-center justify-center rounded-full bg-terracotta text-paper shadow-lifted transition-transform active:scale-[0.97]">
          <PlusIcon className="size-6" aria-hidden="true" />
        </span>
      </Link>

      <UserMenu variant="tab" />
    </nav>
  )
}
