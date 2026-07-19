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

| # | Route(s) | Kind | Count | Message (verbatim, truncated to one line) | Suspected cause | Area / skill |
|---|----------|------|-------|---------------------------------------------|------------------|--------------|
| 1 | `/my/$id/edit` (auth) — **dev only**, 0 in preview | console-error | 53 | `Error: Module "node:fs/promises" has been externalized for browser compatibility. Cannot access "node:fs/promises.mkdir" in client code.` (thrown from `src/server/uploads.ts:1:50`, caught by the `<Lazy>` component's `CatchBoundaryImpl`) | `src/server/uploads.ts` (a server-only module — `createServerFn`-wrapped helpers using `node:fs/promises`/`node:path` for disk-backed cover-image storage) is reachable from the client bundle for this route. Vite externalizes the Node built-in for the browser graph and it throws the moment client code touches it; the route's error boundary retries rendering the `<Lazy>` component from scratch on every retry, and vite's dev-client console forwarding re-echoes the whole error history on each retry, producing the growing "[Server] …[Server] …" cascade until the harness's 4s settle timeout elapses. One underlying defect, not 53 independent bugs. | TanStack Start |

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
- **`/my/$id/edit` (auth) — `Warning: Error in route match:
  /_app/my/$id/edit/my/$id/edit`, 53 occurrences, dev only, 0 in preview**:
  paired 1:1 with Error row 1 above — same cascade, same root cause (each
  failed render of the `<Lazy>` component also fails route matching, logged
  as a `console.warn` immediately before the paired `console.error`, and
  echoed through the same vite `[Server]` forwarding chain). Do not treat as
  a second defect; fix alongside row 1. Area/skill: `TanStack Router` /
  `TanStack Start`.

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
