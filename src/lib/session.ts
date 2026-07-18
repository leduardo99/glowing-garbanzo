/**
 * TanStack Query key for the current session (`getSessionUser`). Shared so
 * the root route's `beforeLoad` can cache the lookup across client-side
 * navigations, and so auth-state changes (login, signup, logout) can
 * invalidate it to force a fresh read.
 */
export const sessionQueryKey = ['session'] as const
