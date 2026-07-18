# Shared Travel Itineraries MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the community travel-itinerary MVP defined in `docs/superpowers/specs/2026-07-18-dominio-roteiros-design.md`: publish/discover itineraries (days → stops), favorites, fork, ratings, comments, private itineraries with invite-link members, cover upload, and a MapLibre/Nominatim map.

**Architecture:** TanStack Start server functions (`createServerFn` + Zod) as the only data layer, consumed with TanStack Query. Drizzle/Postgres for persistence; Better Auth for sessions; permission checks always server-side. UI with shadcn/ui components and Paraglide messages (pt-BR base, en).

**Tech Stack:** TanStack Start/Router/Query/Form, Drizzle ORM (node-postgres), Better Auth, Zod, Paraglide, shadcn/ui, MapLibre GL, Nominatim, Vitest.

## Global Constraints

- Everything in English (routes, code, identifiers, schema, docs, commits); pt-BR ONLY as UI language via Paraglide messages. Never hardcode UI copy — always `m.*` keys, added to BOTH `messages/pt-BR.json` and `messages/en.json`.
- Import alias `#/` → `src/` (never `@/`).
- Every new table lives in `src/db/` and is re-exported by `src/db/schema.ts`; migrations via `pnpm db:generate` + `pnpm db:migrate`.
- Before every commit: `pnpm lint`, `npx tsc --noEmit`, `pnpm build` must pass.
- **Workflow: each task below gets its own branch (name given per task) and its own PR.** Base each branch on the previous task's branch until PRs merge.
- Library APIs you are unsure about: skill first, then Context7 MCP, then the library's GitHub repo (see `CLAUDE.md`).
- Restricted-proxy note: `ui.shadcn.com`, `cdn.jsdelivr.net`, `skills.sh` are blocked in the dev environment; npm registry and raw.githubusercontent.com work.

---

### Task 1: Domain schema and migration

**Branch:** `feat/domain-schema`

**Files:**
- Create: `src/db/itinerary-schema.ts`
- Modify: `src/db/schema.ts`
- Test: `src/db/itinerary-schema.test.ts` (type-level smoke test)

**Interfaces:**
- Consumes: `user` table from `src/db/auth-schema.ts`.
- Produces: tables `itinerary`, `itineraryDay`, `stop`, `favorite`, `rating`, `comment`, `itineraryMember`; enums `itineraryStatus` (`draft|published`), `itineraryVisibility` (`public|private`), `stopCategory` (`attraction|food|lodging|transport|other`). Exact column names as in the spec's domain-model tables.

- [ ] **Step 1: Write the schema** in `src/db/itinerary-schema.ts` using `pgTable`, `pgEnum`, `text`, `integer`, `doublePrecision`, `numeric`, `timestamp`, `primaryKey`. IDs are `text` with `$defaultFn(() => nanoid())` (add `nanoid` dependency). Follow the spec's field tables exactly: `itinerary` (id, authorId FK cascade, title, slug unique, summary, destination, tags `text().array()`, coverImageUrl, status enum default `draft`, visibility enum default `public`, inviteToken, forkedFromId self-FK set-null, ratingAvg numeric, ratingCount integer default 0, publishedAt, createdAt, updatedAt), `itinerary_day` (unique `(itineraryId, dayNumber)`), `stop`, `favorite` (composite PK), `rating` (composite PK, stars integer), `comment`, `itinerary_member` (composite PK). Add indexes: `itinerary.slug`, `itinerary.status+visibility`, `stop.dayId+position`.
- [ ] **Step 2: Re-export** — append `export * from './itinerary-schema'` to `src/db/schema.ts`.
- [ ] **Step 3: Generate + apply migration.** Run: `pnpm db:generate && pnpm db:migrate`. Expected: new SQL file in `drizzle/`, `applying migrations... done`. Inspect the SQL: 7 tables, 3 enums, FKs and uniques present.
- [ ] **Step 4: Smoke test** `src/db/itinerary-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as schema from './schema'

describe('itinerary schema', () => {
  it('exports all domain tables', () => {
    for (const t of ['itinerary', 'itineraryDay', 'stop', 'favorite', 'rating', 'comment', 'itineraryMember'] as const) {
      expect(schema[t]).toBeDefined()
    }
  })
})
```

Run: `pnpm test` → PASS.
- [ ] **Step 5: Quality gates + commit** — `pnpm lint && npx tsc --noEmit && pnpm build`, then commit `feat: add itinerary domain schema and migration`, push, open PR.

---

### Task 2: Pure domain logic — slug, access rules, rating aggregate, fork copy

**Branch:** `feat/domain-logic`

**Files:**
- Create: `src/server/domain/slug.ts`, `src/server/domain/access.ts`, `src/server/domain/rating.ts`, `src/server/domain/fork.ts`
- Test: co-located `*.test.ts` next to each file

**Interfaces (produces — later tasks import these exact names):**

```ts
// slug.ts
export function makeSlug(title: string, random?: () => string): string
// lowercases, strips accents/non-alphanumerics to '-', appends '-' + 6-char suffix

// access.ts — pure, takes plain data, no DB
export interface AccessContext { userId: string | null; isMember: boolean }
export interface ItineraryAccessData {
  authorId: string
  status: 'draft' | 'published'
  visibility: 'public' | 'private'
}
export function canRead(it: ItineraryAccessData, ctx: AccessContext): boolean
export function canEdit(it: ItineraryAccessData, ctx: AccessContext): boolean
export function canRate(it: ItineraryAccessData, ctx: AccessContext): boolean

// rating.ts
export function applyRating(
  agg: { ratingAvg: number | null; ratingCount: number },
  previousStars: number | null,
  newStars: number,
): { ratingAvg: number; ratingCount: number }

// fork.ts — builds insert rows for a fork given source rows
export function buildForkRows(source: {
  itinerary: { title: string; summary: string | null; destination: string; tags: string[]; coverImageUrl: string | null }
  days: Array<{ dayNumber: number; title: string | null; note: string | null; stops: Array<StopCopy> }>
}, newOwnerId: string, sourceItineraryId: string, newSlug: string): ForkRows
```

- [ ] **Step 1: Write failing unit tests** covering: slug normalization ("7 dias na Chapada!" → `7-dias-na-chapada-xxxxxx`); `canRead` truth table (public+published+anon → true; private+published+member → true; private+published+non-member → false; draft+author → true; draft+other → false); `canRate` (public+published+logged → true; private → false; anon → false); `applyRating` for first rating (null→5 ⇒ avg 5, count 1), update (5→3 keeps count), and precision; `buildForkRows` copies structure, resets status to draft, sets `forkedFromId`.
- [ ] **Step 2: Run tests** → FAIL (modules missing).
- [ ] **Step 3: Implement** the four modules minimally.
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Gates + commit** `feat: add pure domain logic (slug, access, rating, fork)`, push, PR.

---

### Task 3: Integration-test harness (test database)

**Branch:** `feat/test-harness`

**Files:**
- Create: `src/test/db.ts` (helpers), `vitest.config.ts` adjustments if needed, `.env.test`
- Test: `src/test/db.test.ts`

**Interfaces (produces):**

```ts
// src/test/db.ts
export async function setupTestDb(): Promise<void>   // creates itineraries_test db if missing, runs drizzle migrations
export async function resetTestDb(): Promise<void>   // truncates all tables
export async function createTestUser(name?: string): Promise<{ id: string; email: string }> // inserts directly into user table
export const testDb: NodePgDatabase<typeof schema>
```

- [ ] **Step 1:** `.env.test` with `DATABASE_URL=postgresql://roteiros:roteiros@localhost:5432/itineraries_test`. `setupTestDb` uses `pg` to `CREATE DATABASE itineraries_test` (ignore "already exists"), then runs `migrate()` from `drizzle-orm/node-postgres/migrator` with `migrationsFolder: './drizzle'`.
- [ ] **Step 2: Failing test** — `db.test.ts`: setup, insert an itinerary for a test user, read it back, reset, expect empty.
- [ ] **Step 3–4:** Implement, run `pnpm test` → PASS.
- [ ] **Step 5:** Gates + commit `feat: add integration test harness with dedicated test database`, push, PR.

---### Task 4: Itinerary server functions (CRUD, publish, search, get, fork)

**Branch:** `feat/itinerary-server-fns`

**Files:**
- Create: `src/server/itineraries.ts`, `src/server/context.ts`
- Test: `src/server/itineraries.test.ts`

**Interfaces:**
- Consumes: Task 1 tables, Task 2 domain logic, Task 3 harness, `auth` from `#/lib/auth`.
- Produces (server functions, all `createServerFn` with Zod validators; each has a plain exported `*Impl(db, session, input)` function that the tests call directly, with the server-fn wrapper delegating to it):

```ts
export const searchItineraries // input: { q?, tags?, minDays?, maxDays?, sort: 'recent'|'top', page } → { items: ItineraryCard[], total }
export const getItineraryBySlug // input: { slug, inviteToken? } → full itinerary with days+stops, viewer flags { canEdit, isFavorite, myStars, isMember } — throws notFound() when canRead fails
export const createItinerary   // input: { title, destination } → { id, slug } (draft, 1 empty day)
export const updateItinerary   // metadata: title, summary, destination, tags, visibility, coverImageUrl
export const deleteItinerary
export const publishItinerary / unpublishItinerary
export const forkItinerary     // input: { id } → { id, slug } — uses buildForkRows, single transaction
```

- `src/server/context.ts` produces `getSessionOrThrow(request)` and `getOptionalSession(request)` wrapping `auth.api.getSession`.

- [ ] **Step 1: Failing integration tests** for: create→get (draft invisible to another user: expect notFound); publish→searchable; search filters (q ILIKE on title/destination/summary; tags overlap; duration between minDays/maxDays; sort top uses ratingAvg desc nulls last); update rejected for non-author; fork creates draft copy with credit and new slug; delete cascades days/stops.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (queries with drizzle `ilike`, `arrayOverlaps`, day-count subquery for duration). **Step 4:** Run → PASS.
- [ ] **Step 5:** Gates + commit `feat: add itinerary server functions`, push, PR.

---

### Task 5: Days & stops server functions

**Branch:** `feat/days-stops-server-fns`

**Files:**
- Create: `src/server/days-stops.ts`
- Test: `src/server/days-stops.test.ts`

**Interfaces (produces):**

```ts
export const addDay / removeDay / updateDay        // removeDay renumbers subsequent days
export const addStop      // { dayId, name, category, description?, costCents?, lat?, lng?, placeLabel? } appends at end
export const updateStop / removeStop
export const reorderStops // { dayId, stopIds: string[] } rewrites position 0..n
export const moveStopToDay // { stopId, targetDayId, position }
```

All check `canEdit` via the parent itinerary; reject otherwise with 403.

- [ ] **Steps 1–4 (TDD):** tests for append position, renumbering on day removal, reorder persistence, move across days, non-author rejection → implement → PASS.
- [ ] **Step 5:** Gates + commit `feat: add day and stop server functions`, push, PR.

---

### Task 6: Engagement server functions (favorite, rating, comments)

**Branch:** `feat/engagement-server-fns`

**Files:**
- Create: `src/server/engagement.ts`
- Test: `src/server/engagement.test.ts`

**Interfaces (produces):**

```ts
export const toggleFavorite // → { favorite: boolean }
export const rateItinerary  // { id, stars 1..5 } upsert; recalculates aggregates via applyRating in one transaction; rejects when !canRate
export const listComments   // paginated, newest first, with author name/image
export const addComment     // requires canRead
export const deleteComment  // author of the comment only
```

- [ ] **Steps 1–4 (TDD):** first rating sets avg/count; re-rating updates avg without count change; rating private/unpublished rejected; favorite toggles; comment add/list/delete; deleting another user's comment rejected → implement → PASS.
- [ ] **Step 5:** Gates + commit `feat: add engagement server functions`, push, PR.

---

### Task 7: Members & invite-link server functions

**Branch:** `feat/members-server-fns`

**Files:**
- Create: `src/server/members.ts`
- Test: `src/server/members.test.ts`

**Interfaces (produces):**

```ts
export const regenerateInviteToken // author, private only → { inviteToken } (nanoid 24)
export const revokeInviteToken     // sets null
export const joinByInviteToken     // logged-in user + valid token → inserts itinerary_member, idempotent → { slug }
export const listMembers / removeMember // author only
```

- [ ] **Steps 1–4 (TDD):** join with valid token grants read (`getItineraryBySlug` succeeds); revoked/regenerated old token fails; removed member loses access; author-only guards → implement → PASS.
- [ ] **Step 5:** Gates + commit `feat: add member and invite-link server functions`, push, PR.

---

### Task 8: Cover upload

**Branch:** `feat/cover-upload`

**Files:**
- Create: `src/server/uploads.ts`, `src/routes/api/uploads/$.ts`
- Modify: `src/env.ts` (add `UPLOADS_DIR` server var, default `./uploads`), `.env.example`, `.gitignore` (+`uploads/`)
- Test: `src/server/uploads.test.ts`

**Interfaces (produces):**

```ts
export const uploadCover // multipart FormData { itineraryId, file } → { url: '/api/uploads/<name>' }
// validates: author only, jpeg/png/webp by magic bytes, ≤ 5 MB; name = nanoid + original extension
```

Serving route `/api/uploads/$` streams the file with correct content-type and immutable cache headers; 404 outside `UPLOADS_DIR` (path traversal guard: resolve + prefix check).

- [ ] **Steps 1–4 (TDD):** rejects oversized/foreign type/non-author; stores and serves round-trip; traversal `../` → 404 → implement → PASS.
- [ ] **Step 5:** Gates + commit `feat: add cover image upload and serving route`, push, PR.

---

### Task 9: Auth pages and app shell

**Branch:** `feat/auth-ui`

**Files:**
- Create: `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/components/AppHeader.tsx`
- Modify: `src/routes/__root.tsx` (header + session in router context via `getOptionalSession`), `messages/pt-BR.json`, `messages/en.json`
- Test: extend existing route smoke tests if present; manual verify step below

**Interfaces:**
- Consumes: `authClient` from `#/lib/auth-client` (`signIn.email`, `signUp.email`, `signOut`, `useSession`).
- Produces: router context `{ session }` used by protected routes (`/new`, `/my/*` `beforeLoad` redirect to `/login?redirect=`).

- [ ] **Step 1:** Message keys (both locales): `auth_login_title`, `auth_signup_title`, `auth_email`, `auth_password`, `auth_name`, `auth_submit_login`, `auth_submit_signup`, `auth_switch_to_signup`, `auth_switch_to_login`, `auth_logout`, `auth_error_invalid`, `nav_my_itineraries`, `nav_new_itinerary`, `app_name`.
- [ ] **Step 2:** Build forms with TanStack Form + shadcn `Input`/`Label`/`Button`/`Card`; errors via `auth_error_invalid`; on success navigate to `redirect ?? '/'`.
- [ ] **Step 3:** Header: app name link, locale switcher (existing `LocaleSwitcher`), login button or user dropdown (avatar, `/my`, logout).
- [ ] **Step 4: Verify end-to-end** — `pnpm dev`; signup → header shows user; logout; login; `/new` while logged out redirects to `/login`.
- [ ] **Step 5:** Gates + commit `feat: add auth pages and app shell`, push, PR.

---

### Task 10: Discovery home and itinerary view (read-only)

**Branch:** `feat/discovery-and-view`

**Files:**
- Create: `src/routes/index.tsx` (replace placeholder), `src/routes/itineraries.$slug.tsx`, `src/components/ItineraryCard.tsx`, `src/components/StopList.tsx`
- Modify: message files (keys below)
- Test: component test for `ItineraryCard` rendering fields

**Interfaces:**
- Consumes: `searchItineraries`, `getItineraryBySlug` (Task 4) through TanStack Query `queryOptions` in route `loader`s.
- Produces: `itineraryQueryOptions(slug, inviteToken?)` and `searchQueryOptions(params)` exported from `src/lib/queries.ts` (create it here) — reused by Tasks 11–12.

- [ ] **Step 1:** Message keys: `home_search_placeholder`, `home_sort_recent`, `home_sort_top`, `home_filter_tags`, `home_filter_duration`, `home_empty`, `view_days_count`, `view_by_author`, `view_forked_from`, `view_day_label`, `stop_category_attraction|food|lodging|transport|other`, `view_cost_estimate`.
- [ ] **Step 2:** Home: search input (debounced URL search params via `validateSearch` + Zod), tag multiselect, duration select, sort tabs, card grid, pagination.
- [ ] **Step 3:** View page: header (cover, title, destination, author, rating summary, fork credit link), day sections with `StopList`, invite-token handling (`?invite=` → call `joinByInviteToken` when logged in, then reload query).
- [ ] **Step 4:** Component test (Vitest + @testing-library/react) for `ItineraryCard`; manual: publish seed itinerary via server fn in dev, see it on home, open by slug. 404 page for unknown slug.
- [ ] **Step 5:** Gates + commit `feat: add discovery home and itinerary view`, push, PR.

---

### Task 11: Editor (create, days/stops, publish, visibility, members)

**Branch:** `feat/editor`

**Files:**
- Create: `src/routes/new.tsx`, `src/routes/my.index.tsx`, `src/routes/my.$id.edit.tsx`, `src/components/editor/DayEditor.tsx`, `src/components/editor/StopForm.tsx`, `src/components/editor/PublishCard.tsx`, `src/components/editor/MembersCard.tsx`
- Modify: message files
- Test: component test for `StopForm` validation; integration already covered server-side

**Interfaces:**
- Consumes: Tasks 4/5/7/8 server functions; `queries.ts` from Task 10.
- Produces: editor routes protected by `beforeLoad` session guard.

- [ ] **Step 1:** `/new`: calls `createItinerary` on submit (title+destination) → navigate to `/my/$id/edit`.
- [ ] **Step 2:** `/my`: two tabs (mine, favorites) using `searchItineraries`-style listing scoped by author (add `listMyItineraries` + `listMyFavorites` server fns here in `src/server/itineraries.ts`, with tests).
- [ ] **Step 3:** Editor page: metadata form (TanStack Form; tags input as comma/enter chips; cover upload wired to `uploadCover`; visibility select), `DayEditor` per day (add/remove day, `StopForm` add/edit, reorder stops with up/down buttons — no dnd library in MVP), `PublishCard` (status, publish/unpublish), `MembersCard` (only when private: invite link with copy button, regenerate/revoke, member list with remove). All mutations invalidate the itinerary query; errors → sonner toast.
- [ ] **Step 4:** Manual verify full authoring flow end-to-end in dev; component test for `StopForm` (required name, cost accepts decimal input → cents).
- [ ] **Step 5:** Gates + commit `feat: add itinerary editor`, push, PR.

---

### Task 12: Map — MapLibre view + Nominatim place search with draggable pin

**Branch:** `feat/map`

**Files:**
- Create: `src/components/map/ItineraryMap.tsx` (read-only pins, fit-bounds, day color accent), `src/components/map/PlacePicker.tsx` (search box + mini map + draggable marker), `src/lib/nominatim.ts`
- Modify: `src/routes/itineraries.$slug.tsx` (embed `ItineraryMap`), `src/components/editor/StopForm.tsx` (embed `PlacePicker`), message files (`map_search_place`, `map_no_results`, `map_drag_hint`)
- Test: `src/lib/nominatim.test.ts` (parsing + debounce contract with mocked fetch)

**Interfaces:**

```ts
// nominatim.ts
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Array<{ label: string; lat: number; lng: number }>>
// GET https://nominatim.openstreetmap.org/search?format=jsonv2&q=... with User-Agent 'roteiros-app'
```

- [ ] **Step 1:** Add deps: `maplibre-gl`. Raster OSM tile style inline (no key). Lazy-load map components with `React.lazy` to keep them out of the main bundle.
- [ ] **Step 2 (TDD for nominatim.ts):** failing tests with mocked `fetch` (maps `display_name/lat/lon`, aborts previous request) → implement → PASS.
- [ ] **Step 3:** `PlacePicker`: debounced (400 ms) search, result list, selecting sets marker; marker `draggable`, dragend updates lat/lng fields; "clear pin" button.
- [ ] **Step 4:** `ItineraryMap`: markers for all stops with popups (name, day), `fitBounds` on load; hidden when no stop has coordinates.
- [ ] **Step 5:** Manual verify in dev (note: Nominatim may be blocked in the remote dev proxy — verify UI degrades gracefully per spec; final check happens in an unrestricted environment). Gates + commit `feat: add itinerary map and place picker`, push, PR.

---

### Task 13: Engagement UI (stars, favorite, comments) and polish

**Branch:** `feat/engagement-ui`

**Files:**
- Create: `src/components/RatingStars.tsx`, `src/components/FavoriteButton.tsx`, `src/components/Comments.tsx`
- Modify: `src/routes/itineraries.$slug.tsx`, `src/routes/index.tsx` (card shows avg/count), message files (`rate_action`, `favorite_add`, `favorite_remove`, `comments_title`, `comments_placeholder`, `comments_submit`, `comments_delete`, `comments_empty`, `fork_action`, `fork_created`)
- Test: component test for `RatingStars` (renders avg, submits selection, disabled when not allowed)

- [ ] **Step 1 (TDD):** `RatingStars` test → implement (5 buttons, optimistic update via Query, hidden/disabled per viewer flags from `getItineraryBySlug`).
- [ ] **Step 2:** `FavoriteButton` (toggle + optimistic), fork button (calls `forkItinerary` → navigate to editor, toast `fork_created`).
- [ ] **Step 3:** `Comments`: list (paginated "load more"), add form, delete own; relative timestamps via `Intl.RelativeTimeFormat` keyed to current locale.
- [ ] **Step 4:** Manual verify all interactions logged-in and logged-out (logged-out → CTA to `/login`).
- [ ] **Step 5:** Gates + commit `feat: add engagement UI`, push, PR.

---

## Self-review (done at plan time)

- **Spec coverage:** schema→T1; access rules→T2/T4-7; search/discovery→T4/T10; days/stops→T5/T11; favorites/ratings/comments→T6/T13; private+invites→T7/T11; uploads→T8; auth pages→T9; view+map→T10/T12; errors (Zod, 404, redirect, toasts)→T4-13 steps; tests (unit/integration/component)→T2/T3+every task. No spec section without a task.
- **Type consistency:** server-fn names in T10–T13 match T4–T8 exports; `queries.ts` produced in T10 and consumed in T11–T12; access helpers named `canRead`/`canEdit`/`canRate` everywhere.
- **Placeholders:** none — every step states files, names, and expected behavior; code blocks given where interfaces are load-bearing.
