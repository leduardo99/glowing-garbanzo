# Design: Landing page, dedicated auth, and route restructure

Date: 2026-07-19
Status: approved (built in-session at the author's request; decisions delegated)

## Vision

Give Roteiros a real front door. Anonymous visitors land on a brand page whose
hero is the product itself — a live map with the community's routes drawn on
it — plus the best of the catalog (top rated, most viewed). Login/signup grow
into a dedicated split-screen experience. The app's discovery grid moves to
`/explore` and stays public.

## Decisions

- **Routes**: `/` becomes the landing (redirects signed-in users to
  `/explore`); `/explore` is the previous discovery page, public, otherwise
  unchanged. The mobile bottom tab "Início" points at `/explore` (the app
  home); the wordmark points at `/`.
- **Hero imagery**: a real MapLibre map (same OSM raster style as the detail
  page) rendering every published+public itinerary's geocoded stops with the
  drawn-route signature — amber dashed lines, mata dots. Interactive but
  calm: drag/click enabled, scroll-zoom disabled so the page keeps scrolling.
  Clicking a route opens the itinerary. Degrades to the RouteSketch panel
  when there are no geocoded routes or WebGL is unavailable.
- **Most viewed**: new `view_count` integer on `itinerary`, incremented
  best-effort on every public detail view by a non-author (anonymous
  included). No dedupe (MVP) — it's a popularity signal, not analytics.
- **Landing sections**: hero map → top rated (rating sort, reuses
  ItineraryCard) → most viewed (view_count sort) → how-it-works (a genuine
  3-step sequence: find → fork → make it yours) → closing CTA. Sections
  render only when they have data; the page never shows empty shelves.
- **Auth**: `/login` and `/signup` share a split-screen shell — deep-mata
  brand panel (drawn route, positioning copy) beside the form on desktop,
  condensed brand header above the form on mobile. Same routes, same
  `?redirect=` contract.
- **Server**: `src/server/landing.ts` with `getLandingHighlightsImpl(db)` →
  `{ topRated, mostViewed, mapRoutes }` (all published+public only; capped);
  thin GET `createServerFn`. View counting lives in
  `getItineraryBySlugImpl` (fire-and-forget update, never fails the read).

## Out of scope

Per-user view dedupe; trending/decay ranking; editorial curation; marketing
CMS; SEO landing variants.

## Tests

- `view_count` increments for anonymous/non-author public views, not for the
  author, not for drafts/private.
- `getLandingHighlightsImpl` ordering (rating vs views), public-only
  filtering, and the geocoded-routes payload shape.
