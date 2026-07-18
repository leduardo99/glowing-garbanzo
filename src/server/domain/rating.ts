/**
 * Recomputes the itinerary rating aggregate for either a first-time rating
 * (previousStars === null, count grows by one) or a re-rating (previousStars
 * is the user's prior stars, count stays the same, average is adjusted).
 */
export function applyRating(
  agg: { ratingAvg: number | null; ratingCount: number },
  previousStars: number | null,
  newStars: number,
): { ratingAvg: number; ratingCount: number } {
  const currentSum = (agg.ratingAvg ?? 0) * agg.ratingCount

  if (previousStars === null) {
    const ratingCount = agg.ratingCount + 1
    const ratingAvg = (currentSum + newStars) / ratingCount
    return { ratingAvg, ratingCount }
  }

  const ratingCount = agg.ratingCount
  const ratingAvg =
    ratingCount === 0
      ? newStars
      : (currentSum - previousStars + newStars) / ratingCount
  return { ratingAvg, ratingCount }
}
