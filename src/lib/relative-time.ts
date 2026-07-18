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

export function formatRelativeTime(date: Date, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  let duration = (date.getTime() - Date.now()) / 1000

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
