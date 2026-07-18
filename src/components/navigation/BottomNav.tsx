import { Link } from '@tanstack/react-router'
import { BookOpenIcon, HomeIcon, PlusIcon } from 'lucide-react'

import { UserMenu } from '#/components/navigation/UserMenu'
import { tabLinkClassName } from '#/components/navigation/tabLinkClassName'
import { m } from '#/paraglide/messages'

/**
 * Fixed bottom tab bar — the primary navigation surface on mobile
 * (`md:hidden`; `AppHeader` carries desktop nav instead). Four tabs per
 * DESIGN.md's Navigation section: Home/Search, My itineraries, New
 * (elevated pill CTA), Profile. All targets are ≥44px and the bar honors
 * `env(safe-area-inset-bottom)` for devices with a home indicator.
 *
 * Box model (see .interface-design/system.md's "Bottom tab bar" entry for
 * the full record): the bar is a fixed `4rem` (64px) content row plus
 * `env(safe-area-inset-bottom)` — `h-[calc(4rem+env(...))]` on the `<nav>`
 * with a matching `pb-[env(...)]` keeps the *content* row exactly 64px
 * regardless of device inset (Tailwind's border-box default means padding
 * eats into `h-*`, not adds to it). `items-stretch` on the `<nav>` then
 * stretches all four tab items to that same 64px, and each item centers
 * its own icon+label with `items-center justify-center` — that's what
 * pins Home/My itineraries/Profile to one shared optical baseline
 * regardless of their differing content (icon vs. avatar).
 *
 * The "+" FAB is the one deliberate exception: no label, floating half
 * above the bar (its slot is centered like every other tab, then
 * `-translate-y-8` — exactly half the 64px row — lifts its *center* to sit
 * on the bar's top edge, so half the circle floats above chrome and half
 * stays inside it). This was chosen over a labeled/baseline-matched FAB
 * per DESIGN.md's "elevated pill button" framing — a raised circle with a
 * label crowds an already-small 64px row and reads as a fifth line of
 * text; unlabeled + floating is the standard native pattern and keeps the
 * FAB legible as "the prominent action," not "a fifth tab."
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
      <Link to="/" activeOptions={{ exact: true }} className={tabLinkClassName}>
        <HomeIcon className="size-6" aria-hidden="true" />
        <span className="text-[11px] font-medium">{m.nav_home()}</span>
      </Link>

      <Link to="/my" className={tabLinkClassName}>
        <BookOpenIcon className="size-6" aria-hidden="true" />
        <span className="text-[11px] font-medium">
          {m.nav_my_itineraries()}
        </span>
      </Link>

      <Link
        to="/new"
        className="flex flex-1 flex-col items-center justify-center"
        aria-label={m.nav_new_itinerary()}
      >
        <span className="flex size-12 -translate-y-8 items-center justify-center rounded-full bg-terracotta text-paper shadow-lifted transition-transform active:scale-[0.97]">
          <PlusIcon className="size-6" aria-hidden="true" />
        </span>
      </Link>

      <UserMenu variant="tab" />
    </nav>
  )
}
