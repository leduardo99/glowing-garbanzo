/**
 * Client-side geocoding against OpenStreetMap's public Nominatim API (no
 * API key — see the design doc's Media/Map decisions). Called directly from
 * the browser (`PlacePicker`), never from a server function — see
 * `itineraries.ts`'s doc comment: "Geocoding is called from the client in
 * the editor; the server only persists validated lat/lng/placeLabel."
 *
 * User-Agent note (design doc Risks: "Nominatim rate limit... debounce in
 * the editor search and a proper User-Agent header"): browsers silently
 * ignore or override a `User-Agent` header set via `fetch()` — there is no
 * reliable way to identify the app that way from client-side JS. We still
 * pass the header below (harmless if dropped, honored by some runtimes),
 * but the practical identifier Nominatim's usage policy actually sees from
 * a browser call is the automatically-attached `Referer` (the site's own
 * origin) — nothing else to add here without routing search through a
 * server function, which would be a bigger change than this task's scope.
 * Rate-limit pressure itself is handled by `PlacePicker`'s 400ms debounce.
 */

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

export interface NominatimPlace {
  label: string
  lat: number
  lng: number
}

interface NominatimResultItem {
  display_name?: unknown
  lat?: unknown
  lon?: unknown
}

/** One in-flight request at a time — a new call aborts whatever's still pending, so a slow response for a stale query can never overwrite a fresher one's results. */
let pendingController: AbortController | null = null

function toPlace(item: NominatimResultItem): NominatimPlace | null {
  if (typeof item.display_name !== 'string') {
    return null
  }
  const lat = typeof item.lat === 'string' ? Number(item.lat) : NaN
  const lng = typeof item.lon === 'string' ? Number(item.lon) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }
  return { label: item.display_name, lat, lng }
}

/**
 * Searches Nominatim for `query`. Never throws — a network failure, a
 * non-OK response, an aborted request, or a malformed body all resolve to
 * `[]` so the caller (the editor's place search UI) degrades gracefully:
 * results just look empty, stop saving is never blocked (see the design
 * doc's Errors section: "Nominatim unavailable -> the editor keeps
 * working; the pin is simply left unset").
 *
 * `signal`, if given, lets the caller cancel the request too (e.g. on
 * unmount) in addition to the automatic previous-request cancellation
 * described above.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimPlace[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  pendingController?.abort()
  const controller = new AbortController()
  pendingController = controller

  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const url = new URL(NOMINATIM_SEARCH_URL)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('q', trimmed)

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'roteiros-app',
      },
    })

    if (!response.ok) {
      return []
    }

    const data: unknown = await response.json()
    if (!Array.isArray(data)) {
      return []
    }

    const places: NominatimPlace[] = []
    for (const item of data as NominatimResultItem[]) {
      const place = toPlace(item)
      if (place) {
        places.push(place)
      }
    }
    return places
  } catch {
    return []
  } finally {
    if (pendingController === controller) {
      pendingController = null
    }
    signal?.removeEventListener('abort', onExternalAbort)
  }
}
