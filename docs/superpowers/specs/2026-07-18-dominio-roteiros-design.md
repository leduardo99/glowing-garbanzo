# Design: shared travel itineraries domain

Date: 2026-07-18
Status: approved (brainstorming session with the user on 2026-07-18)

Language convention: code, routes, identifiers, and docs are in English. Portuguese (pt-BR) exists only as a site UI language via Paraglide messages.

## Vision

A community platform to **publish and discover travel itineraries**. Authors create itineraries structured as days and stops; readers discover, save, rate, comment, and copy (fork) itineraries to adapt them to their own trips. Itineraries can also be **private**, accessible only to members invited via link.

Product decisions from the brainstorming session:

- Core use case: **publish to the community** (not a real-time collaborative planning tool).
- Structure: **days → ordered stops**, no per-stop times.
- MVP interactions: **save/favorite, fork, rate (stars), comment**.
- Discovery: **destination (free text) + style tags**, text search, tag/duration filters.
- Lifecycle: **draft → published** (no "unlisted" state; private visibility covers that case).
- Media: **cover photo + map of stops** (MapLibre + Nominatim geocoding, adjustable pin).
- Privacy: itinerary is **public or private**; private ones are accessible only to the author and members invited via a **token link** (no email infra in the MVP).

Architecture decisions:

- Data via **TanStack Start server functions** (`createServerFn` + Zod) consumed with **TanStack Query**. No extra RPC layer.
- **MapLibre GL** for maps and **Nominatim (OSM)** for place search, with a draggable pin; coordinates persisted in the database. No API key.

## Domain model (Drizzle / Postgres)

All new tables live in `src/db/` and are re-exported by `src/db/schema.ts`. User FKs reference the Better Auth `user` table (`src/db/auth-schema.ts`).

### `itinerary`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text (nanoid) | PK |
| `authorId` | text → `user.id` | not null, on delete cascade |
| `title` | text | not null |
| `slug` | text | unique; generated from title + short random suffix; immutable after creation |
| `summary` | text | short description for cards and header |
| `destination` | text | main destination, free text ("Chapada Diamantina, BA") |
| `tags` | text[] | style tags (adventure, food, budget, family…) |
| `coverImageUrl` | text nullable | cover URL (served by the uploads route) |
| `status` | enum `draft` \| `published` | drafts are visible to the author only |
| `visibility` | enum `public` \| `private` | private: excluded from discovery, access restricted to author + members |
| `inviteToken` | text nullable | invite-link token for private itineraries; regenerable (revokes the previous one) |
| `forkedFromId` | text nullable → `itinerary.id` | credit to the original; on delete set null |
| `ratingAvg` | numeric nullable | denormalized; updated on every rating |
| `ratingCount` | integer default 0 | denormalized |
| `publishedAt` | timestamp nullable | |
| `createdAt` / `updatedAt` | timestamp | |

### `itinerary_day`

`id`, `itineraryId` (FK cascade), `dayNumber` (1..n, unique per itinerary), `title?`, `note?`. Itinerary duration is the number of days.

### `stop`

`id`, `dayId` (FK cascade), `position` (order within the day), `name` (not null), `category` (enum: `attraction` | `food` | `lodging` | `transport` | `other`), `description?` (author's tip), `costCents?` (integer, BRL in the MVP), `lat?` / `lng?` (double), `placeLabel?` (address returned by Nominatim). A stop can exist without a pin (geocoding is optional).

### `favorite`

Composite PK (`userId`, `itineraryId`), `createdAt`. Cascading FKs.

### `rating`

Composite PK (`userId`, `itineraryId`), `stars` (1–5), `createdAt`, `updatedAt`. Upsert per user; every mutation recalculates the itinerary's `ratingAvg`/`ratingCount` in the same transaction. Only allowed on published public itineraries.

### `comment`

`id`, `itineraryId` (FK cascade), `authorId` (FK), `body` (not null), `createdAt`. Hard delete by the comment's own author. No threads/moderation in the MVP.

### `itinerary_member`

Composite PK (`itineraryId`, `userId`), `createdAt`. Populated when a logged-in user opens a valid invite link. Private-itinerary members can read, comment, favorite, and fork. The author lists and removes members.

## Permissions

Always checked **server-side**, inside the server functions:

| Action | Who |
| --- | --- |
| View itinerary | public+published: anyone (even logged out). Private+published: author and members. Draft: author only |
| Create / edit / publish / unpublish / delete | author only |
| Generate/revoke invite link | author only (private itineraries only) |
| Remove member | author only |
| Fork | logged in with read access to the itinerary; creates a full copy (days+stops) as the user's draft, with `forkedFromId` |
| Favorite / comment | logged in with read access |
| Rate | logged in; published public itineraries only; one rating per user (upsert) |

Note: "Remove member" is not restricted to private itineraries — this lets the author clean up stale membership rows after a private→public flip (adjudicated during Task 7).

## Routes (TanStack Router, file-based)

| Route | Content |
| --- | --- |
| `/` | Discovery: text search (title/destination/summary, ILIKE), tag and duration filters, sort by recent or top rated; cards (cover, destination, day count, rating) |
| `/itineraries/$slug` | View: cover, summary, author, fork credit, days with stops, MapLibre map with pins, stars, favorite, fork, comments. Accepts `?invite=<token>` to join as a member |
| `/new` | Creates a draft and redirects to the editor |
| `/my/$id/edit` | Editor: metadata (title, destination, tags, cover, visibility), days and stops with reordering, Nominatim search + draggable pin, publish/unpublish, invite link and members (if private) |
| `/my` | My itineraries (drafts and published) + favorites |
| `/login`, `/signup` | Better Auth (email/password) |

Server routes: `/api/auth/$` (existing), `/api/uploads/$` (serves files from `UPLOADS_DIR`).

## Server functions

Domain modules in `src/server/`, all with Zod validation and consumed via TanStack Query:

- `itineraries.ts` — `searchItineraries` (text/tags/duration/sort, paginated), `getItineraryBySlug` (applies access rules; accepts invite token), `createItinerary`, `updateItinerary`, `deleteItinerary`, `publishItinerary`, `unpublishItinerary`, `forkItinerary`
- `days-stops.ts` — day and stop CRUD, `reorderStops`, `moveStopToDay`
- `engagement.ts` — `toggleFavorite`, `rateItinerary`, `addComment`, `deleteComment`, `listComments`
- `members.ts` — `regenerateInviteToken`, `revokeInviteToken`, `joinByInviteToken`, `listMembers`, `removeMember`
- `uploads.ts` — cover upload (validates type/size, writes to `UPLOADS_DIR`, returns URL)

Geocoding (Nominatim) is called **from the client** in the editor (place search); the server only persists validated `lat`/`lng`/`placeLabel`.

## Errors

- Zod in every server function; form errors return field by field (TanStack Form).
- Unknown slug or no read access → 404 (does not leak the existence of private itineraries).
- Mutation without a session → redirect to `/login` (returning to the origin page).
- Mutation failure → toast (sonner) with an i18n message.
- Nominatim unavailable → the editor keeps working; the pin is simply left unset (optional).
- Invalid/revoked invite link → page explains and suggests asking the author for a new link.

## Tests (Vitest)

- **Unit** (pure, no IO): slug generation, `ratingAvg`/`ratingCount` recalculation, fork copy (day/stop structure), access rules (`canRead`/`canEdit`).
- **Integration**: server functions against an `itineraries_test` database with real migrations — flows: create→publish→search; fork with credit; invite: generate link→join→revoke→access denied; rating upsert and aggregates.
- **Component**: stop editor (add/reorder) and rating form.

## Out of scope (MVP)

Real-time collaborative editing; email invites (the member model already supports it); per-stop photos; curated destination taxonomy; public author profile page; moderation/admin; multiple currencies; mobile app; notifications.

## Risks and mitigations

- **Nominatim rate limit** (1 req/s): debounce in the editor search and a proper `User-Agent` header; if it becomes a bottleneck, swapping in a paid service is an isolated change in the search component.
- **Uploads in production**: `UPLOADS_DIR` on disk assumes a host with a persistent filesystem (Railway/VM). Migrating to S3 only changes `uploads.ts` and the serving route.
- **ILIKE search** does not scale to large content volumes: acceptable in the MVP; the evolution path is `pg_trgm`/tsvector with no API change.
