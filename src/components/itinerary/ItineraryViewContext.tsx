import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

import type { SessionUserView } from '#/server/auth'

/**
 * Everything the itinerary detail page's engagement surface (rating,
 * favorite, fork, comments) needs about *who's looking* — as opposed to
 * the itinerary's own content, which flows down as ordinary props
 * (`data`/`days`) since it's the page's one real subject, not viewer
 * state.
 *
 * Without this, `ItineraryView` would have to thread `itineraryId` /
 * `slug` / `inviteToken` / `redirectTarget` / `session` / `canRate`
 * through `EngagementBar` down to `RatingStars`, `FavoriteButton`, and
 * `ForkButton` (and again to `Comments`) — the exact "viewer flags/session
 * drilled into engagement components" prop-tunneling the part 2 UI pass
 * is meant to remove. `RatingStars` / `FavoriteButton` / `ForkButton`
 * themselves keep their existing explicit-prop APIs (they're unit-tested
 * standalone, outside any provider) — only the *page-level* wiring moves
 * to context.
 */
interface ItineraryViewContextValue {
  itineraryId: string
  slug: string
  inviteToken?: string
  redirectTarget: string
  session: SessionUserView | null
  /**
   * UI-side approximation of the server's `canRate` rule (logged in +
   * published + public) — see `RatingStars`' own doc comment for why this
   * is only ever a rendering hint, never trusted for the actual mutation.
   */
  canRate: boolean
}

const ItineraryViewContext = createContext<ItineraryViewContextValue | null>(
  null,
)

export function ItineraryViewProvider({
  value,
  children,
}: {
  value: ItineraryViewContextValue
  children: ReactNode
}) {
  return (
    <ItineraryViewContext.Provider value={value}>
      {children}
    </ItineraryViewContext.Provider>
  )
}

export function useItineraryView(): ItineraryViewContextValue {
  const context = useContext(ItineraryViewContext)
  if (!context) {
    throw new Error(
      'useItineraryView must be used within an ItineraryViewProvider',
    )
  }
  return context
}
