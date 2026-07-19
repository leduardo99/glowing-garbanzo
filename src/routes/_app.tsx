import { Outlet, createFileRoute } from '@tanstack/react-router'

import { AppHeader } from '#/components/AppHeader'
import { BottomNav } from '#/components/navigation/BottomNav'

/**
 * The app shell — a pathless layout route wrapping every screen that
 * lives inside the product chrome (AppHeader on top, BottomNav's fixed
 * tab bar on mobile). Membership is structural, not path-matched: a
 * route gets the shell by sitting under `_app.` in the file tree, and a
 * new route added there inherits it automatically.
 *
 * The landing (`/`) and the auth pages (`/login`, `/signup`,
 * `/forgot-password`, `/reset-password`) live OUTSIDE this layout — they
 * own their whole viewport and render their own chrome (the landing's
 * transparent header/footer, AuthShell's split screen). Note the split
 * is shell vs. chromeless, not authenticated vs. anonymous: `/explore`
 * and the itinerary detail are public and still belong in the shell.
 *
 * The wrapper div reserves room for BottomNav's fixed bar on mobile (it
 * would otherwise overlap the last bit of page content) — matching the
 * bar's own `h-[calc(4rem+env(safe-area-inset-bottom))]` exactly
 * (BottomNav.tsx). BottomNav is `md:hidden`, so the padding drops in
 * lockstep at the same breakpoint.
 */
export const Route = createFileRoute('/_app')({
  component: AppShell,
})

function AppShell() {
  return (
    <>
      <AppHeader />
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </>
  )
}
