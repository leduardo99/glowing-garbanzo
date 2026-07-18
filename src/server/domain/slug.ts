import { nanoid } from 'nanoid'

function defaultRandom(): string {
  return nanoid(6)
}

// Matches combining diacritical marks (U+0300–U+036F) left behind by NFD normalization.
const COMBINING_DIACRITICS = /[̀-ͯ]/g

/**
 * Builds a URL-safe slug from a title: strips accents, lowercases,
 * replaces any run of non-alphanumeric characters with a single dash,
 * trims leading/trailing dashes, and appends a random suffix to keep
 * slugs unique even for identical titles.
 */
export function makeSlug(
  title: string,
  random: () => string = defaultRandom,
): string {
  const suffix = random()
  const base = title
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base ? `${base}-${suffix}` : suffix
}
