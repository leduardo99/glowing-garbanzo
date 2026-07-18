import { FavoriteButton } from '#/components/FavoriteButton'
import { ForkButton } from '#/components/ForkButton'
import { RatingStars } from '#/components/RatingStars'
import { useItineraryView } from '#/components/itinerary/ItineraryViewContext'

/**
 * Rating + favorite + fork, grouped as the page's one engagement surface.
 * Viewer/session fields (`itineraryId`, `slug`, `inviteToken`,
 * `redirectTarget`, `canRate`, logged-in state) come from
 * `ItineraryViewProvider` via `useItineraryView` — only the itinerary's
 * own rating/favorite numbers, which vary per render and aren't viewer
 * identity, are passed in as props.
 */
export function EngagementBar({
  ratingAvg,
  ratingCount,
  myStars,
  isFavorite,
}: {
  ratingAvg: number | null
  ratingCount: number
  myStars: number | null
  isFavorite: boolean
}) {
  const { itineraryId, slug, inviteToken, redirectTarget, session, canRate } =
    useItineraryView()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <RatingStars
        itineraryId={itineraryId}
        slug={slug}
        inviteToken={inviteToken}
        ratingAvg={ratingAvg}
        ratingCount={ratingCount}
        myStars={myStars}
        canRate={canRate}
        redirectTarget={redirectTarget}
      />
      <FavoriteButton
        itineraryId={itineraryId}
        slug={slug}
        inviteToken={inviteToken}
        isFavorite={isFavorite}
        loggedIn={Boolean(session)}
        redirectTarget={redirectTarget}
      />
      <ForkButton
        itineraryId={itineraryId}
        loggedIn={Boolean(session)}
        redirectTarget={redirectTarget}
      />
    </div>
  )
}
