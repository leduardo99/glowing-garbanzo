import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

import { paraglideMiddleware } from '#/paraglide/server'

/**
 * TanStack Start server entry.
 *
 * Wraps the default request handler with Paraglide's `paraglideMiddleware`
 * so the locale (from the `PARAGLIDE_LOCALE` cookie — see
 * `vite.config.ts`'s `strategy: ['cookie', 'baseLocale']`) is resolved once
 * per request and made available to `getLocale()` calls during SSR via
 * AsyncLocalStorage. Without this, `getLocale()` on the server always falls
 * back to `baseLocale` because there is no request context to read the
 * cookie from (see `src/paraglide/runtime.js`'s `extractLocaleFromCookie`,
 * which short-circuits when `document` is undefined).
 *
 * We don't use the `url` strategy, so there's no URL de-localization for
 * TanStack Router to fight with — the modified `request` handed back by the
 * middleware callback is safe to forward as-is.
 *
 * @see https://paraglidejs.com/middleware
 * @see https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide
 */
const startHandler = createStartHandler(defaultStreamHandler)

export default {
  fetch(request: Request) {
    return paraglideMiddleware(request, ({ request: localizedRequest }) =>
      startHandler(localizedRequest),
    )
  },
}
