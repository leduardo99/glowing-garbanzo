/**
 * Error-handling convention shared by every server module's `*Impl`
 * functions (itineraries, days/stops, engagement):
 *
 * Every failure is a plain `Error` whose `message` is one of three sentinel
 * strings:
 *   - 'UNAUTHORIZED' — the action requires a session and none was given.
 *   - 'FORBIDDEN'    — a session was given but the caller lacks permission
 *                       (e.g. editing someone else's itinerary).
 *   - 'NOT_FOUND'    — the itinerary doesn't exist *or* the caller has no
 *                       read access to it. These two cases are always
 *                       collapsed into the same error so a private/draft
 *                       itinerary's existence is never leaked, per the
 *                       design spec's Errors section.
 * Callers (route loaders, UI) inspect `error.message` to decide how to
 * react (e.g. redirect to `/login`, render a 404).
 */

export const ERR_UNAUTHORIZED = 'UNAUTHORIZED'
export const ERR_FORBIDDEN = 'FORBIDDEN'
export const ERR_NOT_FOUND = 'NOT_FOUND'
