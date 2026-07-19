import { getLocale } from '#/paraglide/runtime'

/**
 * Formats a cost stored in cents into the itinerary's own currency, in the
 * viewer's locale conventions (pt-BR: "R$ 1.234,56"; en: "R$1,234.56").
 * Every itinerary carries a `currency` (ISO 4217, BRL default) and ALL of
 * its stop costs are in that one currency — there is no per-stop currency
 * and no conversion (plan decision).
 */
export function formatCost(cents: number, currency: string): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

/** The curated currency choices offered by the editor's selector. */
export const CURRENCY_OPTIONS = [
  'BRL',
  'USD',
  'EUR',
  'GBP',
  'ARS',
  'CLP',
  'COP',
  'MXN',
  'PEN',
  'UYU',
] as const

/** Sums every stop cost across a trip's days (0 = no cost data anywhere). */
export function sumTripCostCents(
  days: Array<{ stops: Array<{ costCents: number | null }> }>,
): number {
  let total = 0
  for (const day of days) {
    for (const stop of day.stops) {
      total += stop.costCents ?? 0
    }
  }
  return total
}
