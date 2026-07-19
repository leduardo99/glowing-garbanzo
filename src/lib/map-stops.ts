import type { ItineraryMapStop } from '#/components/map/ItineraryMap'
import type { DayView } from '#/server/itineraries'

/**
 * Flattens a trip's days into the map's stop list. `sequence` counts
 * EVERY stop (not just geocoded ones) so the map's numbered discs always
 * agree with the timeline's numbering — a stop without a pin simply
 * skips its number on the map. Shared by the public detail page and the
 * editor's live map.
 */
export function collectMapStops(days: DayView[]): ItineraryMapStop[] {
  const stops: ItineraryMapStop[] = []
  let sequence = 0
  for (const day of days) {
    for (const stop of day.stops) {
      sequence += 1
      if (stop.lat !== null && stop.lng !== null) {
        stops.push({
          id: stop.id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          dayNumber: day.dayNumber,
          startTime: stop.startTime ? stop.startTime.slice(0, 5) : null,
          sequence,
        })
      }
    }
  }
  return stops
}
