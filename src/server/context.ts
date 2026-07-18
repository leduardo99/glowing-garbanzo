import { auth } from '#/lib/auth'

/** Better Auth session shape returned by `auth.api.getSession`. */
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>

/**
 * Resolves the current Better Auth session for a request, or `null` when
 * the caller is anonymous (no cookie, or an invalid/expired one).
 */
export async function getOptionalSession(request: Request): Promise<AuthSession> {
  return auth.api.getSession({ headers: request.headers })
}

/**
 * Resolves the current session, throwing when there isn't one. Use in
 * server functions that require an authenticated caller — see the
 * error-handling convention documented at the top of `itineraries.ts`.
 */
export async function getSessionOrThrow(request: Request): Promise<NonNullable<AuthSession>> {
  const session = await getOptionalSession(request)
  if (!session) {
    throw new Error('UNAUTHORIZED')
  }
  return session
}
