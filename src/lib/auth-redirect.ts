import { z } from 'zod'

/** Shared `?redirect=` search-param schema for `/login` and `/signup`. */
export const authSearchSchema = z.object({
  redirect: z.string().optional(),
})

/**
 * Narrows a `redirect` search param to a same-origin path, defaulting to
 * `/`. Guards against open redirects (e.g. `https://evil.tld`,
 * `//evil.tld`) that an attacker could craft into the query string.
 */
export function safeRedirectTarget(redirect: string | undefined): string {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }
  return '/'
}
