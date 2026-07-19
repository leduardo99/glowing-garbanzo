/** Shape of a stop row copyable into the `stop` table for a new day. */
export interface StopCopy {
  position: number
  name: string
  category: 'attraction' | 'food' | 'lodging' | 'transport' | 'other'
  description: string | null
  startTime: string | null
  costCents: number | null
  lat: number | null
  lng: number | null
  placeLabel: string | null
}

/** Nested insert rows produced for a fork: an itinerary row plus its days, each with their stops. */
export interface ForkRows {
  itinerary: {
    authorId: string
    title: string
    summary: string | null
    destination: string
    tags: string[]
    coverImageUrl: string | null
    slug: string
    status: 'draft'
    forkedFromId: string
  }
  days: Array<{
    dayNumber: number
    title: string | null
    note: string | null
    stops: StopCopy[]
  }>
}

/**
 * Builds insertable rows to fork an itinerary: copies title/summary/destination/tags/cover
 * plus all days and stops into a new draft owned by `newOwnerId`, crediting the source via
 * `forkedFromId`. Days/stops carry no DB-generated ids — the caller inserts them
 * transactionally, wiring up itineraryId/dayId as rows are created.
 */
export function buildForkRows(
  source: {
    itinerary: {
      title: string
      summary: string | null
      destination: string
      tags: string[]
      coverImageUrl: string | null
    }
    days: Array<{
      dayNumber: number
      title: string | null
      note: string | null
      stops: StopCopy[]
    }>
  },
  { newOwnerId, sourceItineraryId, newSlug }: { newOwnerId: string; sourceItineraryId: string; newSlug: string },
): ForkRows {
  return {
    itinerary: {
      authorId: newOwnerId,
      title: source.itinerary.title,
      summary: source.itinerary.summary,
      destination: source.itinerary.destination,
      tags: [...source.itinerary.tags],
      coverImageUrl: source.itinerary.coverImageUrl,
      slug: newSlug,
      status: 'draft',
      forkedFromId: sourceItineraryId,
    },
    days: source.days.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      note: day.note,
      stops: day.stops.map((s) => ({ ...s })),
    })),
  }
}
