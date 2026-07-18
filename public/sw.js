// Minimal hand-written service worker for Roteiros' installable PWA shell.
//
// `vite-plugin-pwa` (`generateSW`) was tried first (see `vite.config.ts`'s
// comment) but its `closeBundle` hook never fires for either of TanStack
// Start's Vite Environment API build passes, so it silently produced no
// `sw.js` at all even though `pnpm build`/`pnpm build:vercel` succeeded.
// This file is the documented fallback: a small, framework-free SW,
// registered by hand from `src/components/PwaRegister.tsx`.
//
// Scope is deliberately minimal ("minimal precache of the app shell," not
// an offline-first cache of the whole app): only the never-hashed static
// files under `public/` — the web app manifest and the icon set — are
// precached. The compiled JS/CSS bundle is content-hashed per build, and
// without a bundler-integrated plugin there is no reliable, non-fragile
// way for a static file like this one to learn those hashed filenames, so
// it deliberately doesn't try. That's enough to satisfy installability
// (a registered, controlling SW + manifest + icons) and to keep the app's
// icons available offline. SSR page navigations, JS/CSS, and API requests
// are never intercepted (see the `fetch` handler below) — Roteiros pages
// are rendered per request, so serving stale HTML/script from a cache
// would be actively wrong, not a feature.
//
// Bump CACHE_NAME whenever the APP_SHELL file list changes, so returning
// clients pick up the new set instead of keeping a stale cache around.
const CACHE_NAME = 'roteiros-shell-v1'

const APP_SHELL = [
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/maskable-192.png',
  '/maskable-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      // `registerType: 'autoUpdate'`-equivalent: take over immediately
      // instead of waiting for every tab to close.
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (!APP_SHELL.includes(url.pathname)) return

  // Cache-first for the precached app-shell files only — everything else
  // (SSR'd pages, hashed JS/CSS, API calls) passes straight through to
  // the network, untouched.
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)))
})
