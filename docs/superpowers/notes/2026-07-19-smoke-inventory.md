# Smoke inventory — 2026-07-19

Source: `pnpm smoke` (dev) and `pnpm smoke:preview` (production build + `vite
preview`), both re-run fresh for this task. Route list is the harness's fixed
6 anon + 4 auth routes (`scripts/smoke.ts`); only routes with findings are
shown below — the rest (`/login`, `/signup`, `/forgot-password`, `/explore`,
`/itineraries/$slug` anon+auth, `/my`, `/new`) produced zero console
errors/warnings in both modes.

- **dev**: `53 error(s), 57 warning(s) across 10 route visits` (exit 1)
- **preview**: `0 error(s), 4 warning(s) across 10 route visits` (exit 0) —
  `pnpm smoke:preview` completed end-to-end on the first run; **no harness
  fix was needed**.

**Task 6 result (this task's own fixes, see the Status column and the
"New finding" / "Known-risk sites" sections below for detail):**
after fixing row 1 and extending the harness with two more visit groups
(pt-BR locale cookie, 390px mobile viewport), both commands are clean:

- **dev**: `0 error(s), 4 warning(s) across 13 route visits` (exit 0)
- **preview**: `0 error(s), 4 warning(s) across 13 route visits` (exit 0)

The 4 remaining warnings in both modes are the `/` WebGL GPU-stall row,
deferred (see Warnings section) as a headless-GPU/software-driver artifact
this task can't verify against real hardware — every other row is
`fixed:`.

Excluded from the counts below (Node-process stderr printed by the harness's
own spawn, before any route section — not a browser console finding):
the `(node:####) [DEP0190] DeprecationWarning: Passing args to a child
process with shell option true …` line, and a
`pg-connection-string`/`pg` "SECURITY WARNING: The SSL modes 'prefer',
'require', and 'verify-ca' …" notice printed while `ensureSmokeData` opens
its DB connection. Both are harness/tooling noise, identical across dev and
preview, unrelated to any route visit. No connection string or credential
appears in either log.

## Errors

| # | Route(s) | Kind | Count | Message (verbatim, truncated to one line) | Suspected cause | Area / skill | Status |
|---|----------|------|-------|---------------------------------------------|------------------|--------------|--------|
| 1 | `/my/$id/edit` (auth) — **dev only**, 0 in preview | console-error | 53 | `Error: Module "node:fs/promises" has been externalized for browser compatibility. Cannot access "node:fs/promises.mkdir" in client code.` (thrown from `src/server/uploads.ts:1:50`, caught by the `<Lazy>` component's `CatchBoundaryImpl`) | `src/server/uploads.ts` (a server-only module — `createServerFn`-wrapped helpers using `node:fs/promises`/`node:path` for disk-backed cover-image storage) is reachable from the client bundle for this route. Vite externalizes the Node built-in for the browser graph and it throws the moment client code touches it; the route's error boundary retries rendering the `<Lazy>` component from scratch on every retry, and vite's dev-client console forwarding re-echoes the whole error history on each retry, producing the growing "[Server] …[Server] …" cascade until the harness's 4s settle timeout elapses. One underlying defect, not 53 independent bugs. | TanStack Start | **fixed: 521c0e8** — split `src/server/uploads.ts` into client-safe constants/`uploadCover` (unchanged filename) and `src/server/uploads.server.ts` (new, holds `mkdir`/`writeFile`/`path` and all disk/Blob storage logic). The `.server.ts` suffix opts the new file into TanStack Start's default import-protection rule (`**/*.server.*`), so a client-reachable import resolves to an inert mock instead of the real `node:fs/promises`-touching module — the actual module boundary moved, not just the symptom. Confirmed via `pnpm smoke` (dev): 0 errors, cascade and its paired warning row both gone. |

All 53 dev-mode `console-error` findings are occurrences of this single
message (identical payload; only the vite `[Server]` echo-chain prefix and
timestamp grow between occurrences). No `pageerror` or `requestfailed`
findings occurred in either mode. This is the only row in the Errors table —
`errors.length` in both runs (53 dev / 0 preview) is accounted for entirely
by this one grouped defect.

## Warnings (triage in PR 2)

- **`/` (anon) — GL Driver Message, 4 occurrences, present identically in
  both dev and preview**: `[.WebGL-0x…]GL Driver Message (OpenGL,
  Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels` (last
  occurrence suffixed `(this message will no longer repeat)`). Possibly a
  headless-GPU artifact — messages point at the software/SwiftShader-class
  GL driver used by headless Chromium reading back a WebGL canvas (this app
  uses maplibre for map rendering); **verify on a real GPU** before treating
  this as an app defect. Area/skill: `environment (headless GPU)` (and
  `maplibre` if it reproduces on real hardware).
  **deferred: task 6 has no access to a non-headless GPU to verify against.**
  Still present, byte-for-byte identical (same driver message, same "will no
  longer repeat" suffix), across every `pnpm smoke` / `pnpm smoke:preview`
  run in this task (dev and preview, before and after all Task 6 fixes,
  13-route-visit runs included) — it never varies with app code, only ever
  the GL context address changes between runs, which is consistent with a
  driver-level artifact rather than anything the app's maplibre usage
  controls. No code change in this repo can address a headless-Chromium
  software-GL driver's own performance advisory; next verification step is
  running the harness on hardware with a real GPU.
- **`/my/$id/edit` (auth) — `Warning: Error in route match:
  /_app/my/$id/edit/my/$id/edit`, 53 occurrences, dev only, 0 in preview**:
  paired 1:1 with Error row 1 above — same cascade, same root cause (each
  failed render of the `<Lazy>` component also fails route matching, logged
  as a `console.warn` immediately before the paired `console.error`, and
  echoed through the same vite `[Server]` forwarding chain). Do not treat as
  a second defect; fix alongside row 1. Area/skill: `TanStack Router` /
  `TanStack Start`.
  **fixed: 521c0e8** — same commit as Error row 1 (confirmed paired: fixing
  the module boundary cleared both). `pnpm smoke` (dev) after the fix shows
  0 findings of any kind on `/my/$id/edit`.

### New finding surfaced during Task 6 verification (not in the original inventory)

- **`/explore` (anon), preview only — `requestfailed` on
  `tile.openstreetmap.org` tiles, `net::ERR_ABORTED`, 1-2 occurrences,
  non-deterministic count across runs**: surfaced while re-verifying
  `pnpm smoke:preview` after the row-1 fix above (unrelated file —
  `/explore` never touches `uploads.ts`). Root cause: the harness's
  `visit()` waits a fixed 4s after `page.goto` then calls `page.close()`;
  maplibre's live tile fetches to the external OSM tile server are
  routinely still in flight at that point, and Chromium reports the
  resulting cancellation as `net::ERR_ABORTED` — direct `curl` to the exact
  failing tile URLs completed in under 100ms both times, ruling out actual
  network/server slowness. This is the harness's own teardown racing a live
  request, not an app defect.
  **fixed: 30575ad** — `scripts/smoke.ts`'s `requestfailed` listener now
  ignores `net::ERR_ABORTED` specifically (Chromium's dedicated code for a
  browser-canceled request — navigation, `page.close()`, or an app-level
  `AbortController`), while still reporting genuine failures (`ERR_*` for
  DNS, timeout, connection-refused, blocked). Confirmed clean across two
  consecutive `pnpm smoke:preview` runs after the fix.

## Dev-only vs preview-only differences

- **The entire `/my/$id/edit` (auth) cascade is dev-only.** `pnpm
  smoke:preview` visited the same route (with a freshly seeded itinerary)
  and produced zero console findings there. The underlying code path is
  still present in the production bundle — the build step itself printed
  two `[plugin rolldown:vite-resolve]` warnings for the same module
  (`node:fs/promises` and `node:path`, both "externalized for browser
  compatibility", both attributed to `src/server/uploads.ts`) — so this is
  not a dev-only *code* issue, only a dev-only *runtime manifestation*.
  Suspected explanation (unconfirmed — worth checking when this gets fixed
  in PR 2): dev serves the route's lazy chunk transformed on-demand and
  actually executes the `node:fs/promises` accessor, while the production
  build's bundler/rolldown appears to tree-shake the unreached `mkdir` call
  path out of the client chunk the browser actually loads, so the externalized
  stub is never touched at runtime. Given this, **preview passing does not
  clear row 1** — the build-time warning shows the same server/client
  boundary defect exists in both modes; PR 2 should fix the module boundary
  itself (e.g. `createServerOnlyFn`/route-level code-splitting per the
  TanStack Start execution-model guidance), not rely on preview's silence.
- **The `/` (anon) WebGL GPU-stall warnings are identical in both modes**
  (same 4 messages, same last-message text) — not a dev/preview difference,
  consistent with it being headless-Chromium/GPU-driver environment noise
  rather than something the build changes.
- No findings appeared in preview that were absent in dev (preview is a
  strict subset: only the 4 GL warnings, all also present in dev).
- **Update, post-fix (521c0e8):** the `pnpm build` step invoked by `pnpm
  smoke:preview` no longer prints the two `[plugin rolldown:vite-resolve]`
  externalization warnings for `node:fs/promises` / `node:path` —
  confirmed absent from the full build+harness log after the module-
  boundary fix. This is the concrete evidence the fix moved the actual
  module boundary (the client build no longer even reaches the Node
  built-ins), not just silenced the dev-mode symptom.

## Known-risk sites

Verified explicitly per the task-6 brief, in addition to (not instead of)
the rows above — absence from the inventory is evidence, not proof:

- **`formatRelativeTime`** (fixed in Task 5): `grep -rn "formatRelativeTime"
  src/` shows exactly one call site outside its own test —
  `src/components/Comments.tsx:140`, passing `commentsQuery.dataUpdatedAt`
  (a stable, already-resolved value) as the explicit `now` parameter. No
  other SSR'd call site exists. **Verdict: clean, no further action.**
- **`<html lang>`** (`__root.tsx`'s `beforeLoad` imperatively sets
  `document.documentElement.lang` while SSR renders
  `<html lang={getLocale()} suppressHydrationWarning>`): the existing
  harness routes never set a locale cookie, so `getLocale()` was already
  falling through the `['cookie', 'baseLocale']` strategy to `baseLocale`
  (`pt-BR` — see `project.inlang/settings.json` — this app's *default*
  locale, not `en`) on every prior run; that only exercises the fallback
  branch, not the cookie-read branch. Added an explicit
  `PARAGLIDE_LOCALE=pt-BR` cookie context visiting `/` (`feat: smoke
  harness`, commit c6f195b) to exercise `extractLocaleFromCookie` /
  `extractLocaleFromRequestWithStrategies` for real. Also note `<html>`
  already carries `suppressHydrationWarning`, pre-dating Task 6 and
  documented in `__root.tsx` for a *different*, unrelated reason (the
  dark-mode `ScriptOnce` class toggle) — any `lang` mismatch would be
  masked by that same suppression, so the harness visit checks for
  downstream symptoms (any other console error/warning on the page), not a
  React hydration-warning text match, which structurally can't appear here
  either way. **Verdict: clean — 0 findings on the pt-BR-cookie visit in
  both dev and preview.**
- **`matchMedia`-gated surfaces** (`useIsMobile`, `_app.explore.tsx`'s
  `useIsDesktop`): both default to `false` on the server and the first
  client render, updating only from a post-hydration `useEffect` — the
  same SSR-false-then-effect pattern shadcn's own `use-mobile` hook uses,
  safe from a hydration-mismatch standpoint by construction at any
  viewport width. The existing anon/auth contexts run at Chromium's
  default 1280×720; added a 390px context (`feat: smoke harness`, commit
  c6f195b) visiting `/explore` and `/itineraries/$slug` — the two routes
  that actually branch on these hooks — to also confirm the mobile
  component tree itself (map-vs-list layout, `ResponsiveSheet`'s `Drawer`)
  mounts without error post-hydration. **Verdict: clean — 0 findings at
  390px in both dev and preview.**
- **maplibre + TanStack devtools on `/explore` and the itinerary detail
  page**: both routes are already in the harness's fixed route list (anon
  `/explore` and `/itineraries/$slug`, auth `/itineraries/$slug` — 3 visits
  per run) and were visited a second time each at 390px per the bullet
  above (2 more visits per run), across every `pnpm smoke` / `pnpm
  smoke:preview` run in this task. Zero console errors, zero pageerrors,
  zero non-`ERR_ABORTED` request failures on any of them. The only finding
  anywhere near maplibre is the `/` WebGL GPU-stall warning (deferred
  above), which is unrelated to devtools and present on the landing page's
  own map, not `/explore`'s or the detail page's. **Verdict: clean, no
  further action.**
