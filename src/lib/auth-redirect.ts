import { z } from 'zod'

/** Shared `?redirect=` search-param schema for `/login` and `/signup`. */
export const authSearchSchema = z.object({
  redirect: z.string().optional(),
})

/**
 * Narrows a `redirect` search param to a same-origin path, defaulting to
 * `/`. Guards against open redirects (e.g. `https://evil.tld`,
 * `//evil.tld`) that an attacker could craft into the query string.
 *
 * Strict allowlist: the target must start with `/`, its second character
 * must not be `/` or `\` (both are treated as path separators by WHATWG
 * URL parsing for special schemes, so `/\evil.com` would otherwise resolve
 * to `https://evil.com`), and it must not contain a backslash anywhere
 * (belt and braces against the same class of bypass further into the
 * path).
 */
export function safeRedirectTarget(redirect: string | undefined): string {
  if (redirect && /^\/[^/\\]/.test(redirect) && !redirect.includes('\\')) {
    return redirect
  }
  return '/'
}
