import { useRouterState } from '@tanstack/react-router'

/**
 * Routes that own their whole viewport and opt out of the app shell
 * (AppHeader, BottomNav, and the root layout's bottom-nav spacer):
 * the dedicated auth pages (see AuthShell) and the landing page, which
 * renders its own transparent header and footer and is always anonymous
 * (sessions are redirected to /explore in its beforeLoad).
 */
const CHROMELESS_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
])

export function useIsChromelessRoute(): boolean {
  return useRouterState({
    select: (s) => CHROMELESS_PATHS.has(s.location.pathname),
  })
}
