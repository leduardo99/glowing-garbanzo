/**
 * Session lookup exposed to the router's root `beforeLoad`.
 *
 * Thin wrapper around `getOptionalSession`, narrowed to the fields the UI
 * needs (future protected-route guards) so the full Better Auth
 * session/account rows never round-trip to the client.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { getOptionalSession } from './context'

export interface SessionUserView {
  id: string
  name: string
  email: string
  image: string | null
}

export const getSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUserView | null> => {
    const session = await getOptionalSession(getRequest())
    if (!session) {
      return null
    }
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    }
  },
)
