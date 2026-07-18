import { useEffect } from 'react'

/**
 * Registers the hand-written service worker (`public/sw.js`) once the app
 * has hydrated on the client.
 *
 * `vite-plugin-pwa` was the first choice (see `vite.config.ts`'s comment
 * for why it was dropped — its build hook never actually emits `sw.js`
 * under TanStack Start's multi-environment build). Without that plugin
 * there's also no static `index.html` for any HTML-injection-based
 * registration to target anyway (every page is server-rendered per
 * request), so registration happens here instead, inside a plain
 * `useEffect` — which only ever runs on the client, after hydration, never
 * during SSR, so there's no risk of touching `navigator`/`caches` on the
 * server. This is this app's closest equivalent to a "client entry" for
 * PWA bootstrapping, since TanStack Start's client hydration entry is
 * framework-managed and not a user-editable file.
 *
 * `public/sw.js` calls `self.skipWaiting()` / `clients.claim()` itself on
 * install/activate (the hand-rolled equivalent of `vite-plugin-pwa`'s
 * `registerType: 'autoUpdate'`), so a plain
 * `navigator.serviceWorker.register()` here is sufficient — no
 * update-prompt UI needed. Renders nothing; mount once near the app root
 * (`RootDocument`).
 */
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Service worker registration failed', error)
    })
  }, [])

  return null
}
