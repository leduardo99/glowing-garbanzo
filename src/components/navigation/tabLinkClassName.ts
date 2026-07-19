/**
 * Shared layout class for every `BottomNav` tab item (Home, My itineraries,
 * New, Profile). Lives in its own module (not exported from `BottomNav.tsx`
 * directly) so `UserMenu` — which `BottomNav` itself renders for the
 * Profile tab — can reuse it without a `BottomNav` ⇄ `UserMenu` circular
 * import.
 *
 * Relies on the parent `<nav>`'s `items-stretch` (see `BottomNav.tsx`) to
 * receive the bar's full 64px content height; `items-center justify-center`
 * here then centers the icon+label pair within that height, which is what
 * keeps every tab — including the avatar-based Profile tab — on one shared
 * optical baseline.
 *
 * `group` lets the icon pill inside each tab (see `tabIconClassName`) react
 * to the Link's `data-status=active` — the native-app "active tab"
 * treatment: mata text + a soft mata pill behind the icon.
 */
export const tabLinkClassName =
  'group flex flex-1 flex-col items-center justify-center gap-0.5 text-ink-soft transition-colors data-[status=active]:text-mata'

/** Pill wrapper around each tab's icon — fills mata-soft when the tab is active. */
export const tabIconClassName =
  'flex h-7 w-12 items-center justify-center rounded-full transition-colors group-data-[status=active]:bg-mata-soft'
