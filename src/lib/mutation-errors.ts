/**
 * Shared error handling for engagement mutations (favorite, rate, fork,
 * comment). The UI already gates these actions behind a logged-in check
 * (CTA-to-login instead of a live control when `session` is absent), so a
 * live `UNAUTHORIZED` from the server is the rare race — the session
 * expired between render and submit — not the common path. Per the design
 * doc's Errors section ("Mutation without a session → redirect to /login,
 * returning to the origin page"), that race redirects to `/login`; every
 * other failure is left to the caller's own feature-specific toast so the
 * message stays meaningful (`favorite_error`, `rate_error`, ...).
 */
import { useNavigate } from '@tanstack/react-router'

import { ERR_UNAUTHORIZED } from '#/server/errors'

export function useMutationErrorHandler(redirectTarget: string) {
  const navigate = useNavigate()

  return (error: unknown, onOtherError: () => void) => {
    if (error instanceof Error && error.message === ERR_UNAUTHORIZED) {
      void navigate({ to: '/login', search: { redirect: redirectTarget } })
      return
    }
    onOtherError()
  }
}
