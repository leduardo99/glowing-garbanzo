# Runtime Audit & Best-Practices Alignment — Design

**Date:** 2026-07-19
**Status:** Approved (pending spec review)

## Problem

The app shows runtime errors in the browser — hydration errors among them — while
every static gate passes clean (`pnpm lint`, `npx tsc --noEmit`, `pnpm build`,
`pnpm test`). The errors therefore only manifest when JavaScript executes in a
real browser, and nothing in the repo currently reproduces or guards against
them.

Reconnaissance findings that shape this design:

- **TanStack package skew.** `@tanstack/react-router` 1.170.18,
  `@tanstack/react-start` 1.168.30 and `@tanstack/react-router-ssr-query`
  1.167.1 are installed side by side. These packages move in lockstep; the
  `latest` specifiers in `package.json` let every install pull a different,
  potentially incompatible combination. This is the prime root-cause suspect
  for SSR/hydration breakage that appears "out of nowhere".
- **Bleeding-edge base.** TypeScript 6, Vite 8, and a `nitro-nightly` build are
  in the dependency set.
- **Known hydration-risk sites** (to be verified during the audit):
  `formatRelativeTime` uses `Date.now()` and renders into `Comments.tsx`;
  `__root.tsx` sets `lang` via `document.documentElement.setAttribute` in
  `beforeLoad` while also SSR-rendering `lang={getLocale()}`; several surfaces
  are gated by `matchMedia`-driven flags (`useIsMobile`, `_app.explore.tsx`);
  maplibre and the TanStack devtools render client-side into an SSR'd tree.

## Goals

1. Eliminate the runtime errors (hydration and other console errors) at their
   root cause.
2. Make dependency resolution reproducible so the errors cannot silently
   return.
3. Align the code that the errors touch with the best practices of the
   installed skills (TanStack intents, `vercel-react-best-practices`, Better
   Auth, AI SDK, shadcn).
4. Leave a permanent, cheap-to-run browser smoke test in the repo.

## Non-goals

- Refactors not tied to a found problem.
- New features or visual changes.
- A full skill-by-skill audit of healthy areas (explicitly rejected in favor of
  the guided approach below).

## Approach

Root cause first, then a guided audit. Four phases, three PRs, each on its own
branch per project convention.

### Phase 1 — Dependency pinning and alignment (PR 1)

- Replace every `latest` specifier with a concrete version.
- Align all `@tanstack/*` packages on a single, mutually compatible stable
  release train (the newest one available at implementation time).
- Keep `nitro-nightly` only if the pinned TanStack Start release still requires
  it (verify against official TanStack Start docs before deciding); otherwise
  move to the stable `nitro` release it supports.
- Regenerate the lockfile, reinstall, and run all gates.

### Phase 2 — Playwright smoke harness (lands in PR 1)

The harness ships in PR 1 together with the dependency pinning, so the error
inventory exists before any fix work starts and PR 1 can already demonstrate
which errors the pinning alone resolved.

- Add `playwright` as a devDependency plus a `pnpm smoke` script.
- The script seeds what it needs through the app's own APIs: a test user via
  the Better Auth signup API, and one published itinerary owned by that user
  (created through the existing server functions) so the detail page has real
  data to render.
- It starts the dev server, launches headless Chromium, and visits: landing
  (`/`), `/login`, `/signup`, `/explore`, the seeded itinerary's detail page,
  and — authenticated as the test user — `/my`, `/new`, and the editor.
- It captures console errors and warnings (including React 19 hydration
  messages), `pageerror` events, and failed network requests, and prints an
  inventory grouped by route.
- Diagnosis runs against the dev server (detailed React dev warnings); final
  verification also runs against the production build (`vite preview`), since
  hydration behavior differs between the two.
- Requires the local Postgres from `.env` to be running; if it is not
  reachable, stop and ask the user to start it rather than working around it.

### Phase 3 — Fix errors one by one (PR 2)

For each error in the inventory: root-cause it, load the matching skill/intent
guidance before editing (CLAUDE.md policy), fix it, and re-run the harness for
that route. Independently of the inventory, explicitly check the known-risk
sites listed under Problem. All fixes follow existing project conventions
(Paraglide for copy, `#/` imports, English identifiers).

### Phase 4 — Targeted best-practices alignment (PR 3)

Scoped strictly to the areas the errors point at:

- TanStack Start SSR-critical patterns (`createIsomorphicFn`, `ClientOnly`,
  `useHydrated`, execution-model guidance).
- React 19 patterns (`vercel-react-best-practices`) in the components that had
  errors.
- Whatever else the inventory surfaces (e.g. AI SDK streaming usage, Better
  Auth client calls) — each area reviewed against its skill.

Small, focused diffs. Findings that are real but out of scope get documented in
the PR description instead of fixed.

## Error handling

- Postgres down → stop and ask the user; do not mock the database.
- Harness cannot authenticate → seed the test user through the Better Auth
  signup API; if that fails, report instead of stubbing auth.
- If Phase 1 alone clears every error, Phase 3 shrinks accordingly and the
  result is reported honestly — no invented work.

## Acceptance criteria

Every PR passes: `pnpm lint`, `npx tsc --noEmit`, `pnpm build`, `pnpm test`,
and the smoke harness reports **zero console errors** on all covered routes
(dev server and production preview). Console *warnings* are triaged rather
than gated on: each one is either fixed alongside the errors or listed in the
PR description with the reason it was left. The smoke script is committed and
runnable as `pnpm smoke`.
