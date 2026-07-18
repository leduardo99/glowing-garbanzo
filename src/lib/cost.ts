/**
 * Conversion helpers between the editor's free-text BRL cost input (author
 * types "25,50" or "25.50") and the integer `costCents` the server stores
 * (see `stop.costCents` in `src/db/itinerary-schema.ts`). Pure, no i18n or
 * DOM — `StopForm` owns the field-level error message.
 */

/**
 * Parses a decimal cost string into integer cents. Accepts either "," or
 * "." as the decimal separator, with 0–2 fraction digits (no thousands
 * separator support in the MVP). Returns `null` for blank input OR input
 * that doesn't match the accepted shape — the caller treats both as "no
 * cost provided" (matching `costCents`'s nullable server schema); `StopForm`
 * separately shows a validation error for a non-blank value that fails to
 * parse, so silently returning `null` here doesn't hide it from the user.
 */
export function parseCostToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null
  }

  return Math.round(Number(normalized) * 100)
}

/** Formats integer cents back into a plain decimal string (dot separator) for pre-filling an edit form. `null`/`undefined` becomes `''`. */
export function formatCentsToCostInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return ''
  }
  return (cents / 100).toFixed(2)
}
