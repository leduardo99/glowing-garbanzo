/**
 * Shared layout class for every `BottomNav` tab item (Home, My itineraries,
 * Profile — the "+" FAB is deliberately excluded, see `BottomNav.tsx`).
 * Lives in its own module (not exported from `BottomNav.tsx` directly) so
 * `UserMenu` — which `BottomNav` itself renders for the Profile tab — can
 * reuse it without a `BottomNav` ⇄ `UserMenu` circular import.
 *
 * Relies on the parent `<nav>`'s `items-stretch` (see `BottomNav.tsx`) to
 * receive the bar's full 64px content height; `items-center justify-center`
 * here then centers the icon+label pair within that height, which is what
 * keeps every tab — including the avatar-based Profile tab — on one shared
 * optical baseline.
 */
export const tabLinkClassName =
  'flex flex-1 flex-col items-center justify-center gap-0.5 text-ink-soft data-[status=active]:text-terracotta'
