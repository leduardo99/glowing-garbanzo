/**
 * Formats a past (or future) `Date` as a locale-aware relative string
 * ("2 hours ago", "há 2 horas") via the platform's `Intl.RelativeTimeFormat`
 * — no extra date library needed. Used by `Comments` for comment
 * timestamps, keyed to the active Paraglide locale (`getLocale()`).
 *
 * Walks progressively coarser units (seconds → years), the standard MDN
 * idiom for turning a millisecond delta into "the largest unit that keeps
 * the magnitude under its next threshold." `numeric: 'auto'` lets the
 * formatter say "now"/"yesterday" instead of "0 seconds ago"/"1 day ago"
 * where the locale has a word for it.
 *
 * Takes an explicit `now` reference instant rather than defaulting purely
 * to `Date.now()` internally, so a caller can pass a stable value (e.g. a
 * query's `dataUpdatedAt`) and get the identical formatted string on the
 * server render and the client hydration pass — two independent
 * `Date.now()` calls a request apart would otherwise diverge and produce a
 * hydration mismatch.
 */
const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
]

/**
 * `Intl.RelativeTimeFormat` construction does locale negotiation, so it's
 * worth avoiding when the same locale repeats — e.g. `Comments` calling
 * `formatRelativeTime` once per rendered comment. Module-level `Map` cache,
 * keyed by locale (this app only ever has two: `pt-BR`, `en`).
 */
const formatterCache = new Map<string, Intl.RelativeTimeFormat>()

function getFormatter(locale: string): Intl.RelativeTimeFormat {
  let formatter = formatterCache.get(locale)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    formatterCache.set(locale, formatter)
  }
  return formatter
}

export function formatRelativeTime(
  date: Date,
  locale: string,
  // Explicit reference instant so SSR and hydration format the same
  // string — Date.now() differs between the two and mismatches.
  now: number = Date.now(),
): string {
  const formatter = getFormatter(locale)
  let duration = (date.getTime() - now) / 1000

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }

  // Unreachable — the last division's amount is Infinity, so the loop
  // above always returns. Kept for type-safety (a non-void return).
  return formatter.format(Math.round(duration), 'years')
}
