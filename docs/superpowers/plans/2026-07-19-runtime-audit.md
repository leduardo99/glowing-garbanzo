# Runtime Audit & Best-Practices Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the app's browser-runtime errors (hydration mismatches and other console errors), pin the dependency set so they cannot silently return, and align the code the errors touch with the installed best-practices skills.

**Architecture:** Three stacked PRs. PR 1 pins/aligns dependencies and adds a Playwright smoke harness (`pnpm smoke`) that seeds test data, walks every route anonymous + authenticated, and inventories console errors. PR 2 fixes each inventoried error at its root cause (one confirmed bug — nondeterministic `formatRelativeTime` in SSR'd comments — is specified concretely; the rest follow the inventory procedure). PR 3 is a targeted best-practices alignment pass over only the areas PR 2 touched.

**Tech Stack:** TanStack Start (React 19) + Vite 8, Drizzle + Postgres, Better Auth, Playwright (headless Chromium), tsx, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-runtime-audit-design.md`

## Global Constraints

- Everything written in English: code, comments, docs, commits, PRs (CLAUDE.md).
- Never hardcode UI copy — always `m.*` Paraglide messages (`messages/{pt-BR,en}.json`).
- Import alias `#/` → `src/` inside `src/`. **Exception:** files in `scripts/` use relative imports with explicit `.ts` extensions (`../src/db/index.ts`) because they run under `tsx`, outside Vite — and must never import `src/env.ts` or anything that transitively imports it (`#/lib/auth`, `src/server/*`): `env.ts` reads `import.meta.env`, which only exists inside Vite/Vitest.
- Before editing files in a library's area, load the matching skill/intent guidance first (CLAUDE.md policy; skill map in Task 6).
- Gates before every commit that touches `src/`: `pnpm lint`, `npx tsc --noEmit`, `pnpm build`, `pnpm test`.
- Local Postgres from `.env` must be running for the harness; if unreachable, stop and tell the user — never mock the database.
- Acceptance: `pnpm smoke` and `pnpm smoke:preview` report **zero console errors** on all covered routes. Warnings are triaged: fixed or listed in the PR description with a reason — never silently ignored.
- Every fix commit message: `fix: <area> — <one-line cause>`.
- Do not commit `src/routeTree.gen.ts` line-ending churn or `pnpm-workspace.yaml` unless a task explicitly says so.

## Reconnaissance facts (verified 2026-07-19, do not re-derive)

- `pnpm lint`, `npx tsc --noEmit`, `pnpm build`, `pnpm test` all pass on `main` today — the user's errors are browser-runtime only.
- Installed: `@tanstack/react-router` 1.170.18, `@tanstack/react-start` 1.168.30, `react` 19.2.7. `pnpm why @tanstack/react-router` shows a **single** router copy today; the `latest` specifiers are a future-reproducibility hazard, not the confirmed current root cause.
- npm latest today: `@tanstack/react-start` 1.168.32 (its deps exact-pin `@tanstack/react-router` 1.170.18), `@tanstack/react-router-ssr-query` 1.167.1, `@tanstack/react-router-devtools` 1.167.0, `@tanstack/router-plugin` 1.168.23, `@tanstack/router-cli` 1.167.21, `@tanstack/react-query` 5.101.2, `@tanstack/react-query-devtools` 5.101.2, `@tanstack/react-form` 1.33.2, `@tanstack/react-devtools` 0.10.8, `@tanstack/devtools-vite` 0.8.1, `@tanstack/eslint-config` 0.4.0, `playwright` 1.61.1.
- **Confirmed bug:** `_app.itineraries.$slug.tsx` prefetches comments in its loader (`ensureQueryData(commentsQueryOptions(...))` at ~line 101), so `Comments.tsx:140` renders `formatRelativeTime(comment.createdAt, locale)` during SSR — and `src/lib/relative-time.ts:25` uses `Date.now()`, which differs between server render and client hydration → text-content hydration mismatch whenever a comment exists.
- `<html>` already carries `suppressHydrationWarning` for the theme ScriptOnce (`__root.tsx:138`) — that known pattern is handled.
- `SessionUser` (accepted by all `*Impl` functions) is `{ user: { id: string } }` (`src/server/itineraries.ts:62`).
- Routes: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password` (token-gated — not smoke-tested), `/explore`, `/itineraries/$slug`, `/my`, `/new`, `/my/$id/edit`.
- Better Auth REST (from `better-auth@1.6.x`, route `src/routes/api/auth/$.ts`): `POST /api/auth/sign-up/email` `{ name, email, password }`, `POST /api/auth/sign-in/email` `{ email, password }`, `GET /api/auth/get-session` → `{ user: { id, ... }, session: {...} } | null`. Signup has no email-verification gate (`src/lib/auth.ts` sets none).
- `tsconfig.json` `include` already covers `scripts/**/*.ts`; `allowImportingTsExtensions` is on.
- Dev server: `pnpm dev` = `vite dev --port 3000`; `BETTER_AUTH_URL=http://localhost:3000` — the harness must serve on port 3000 (dev **and** preview) so auth origins match.

---

# PR 1 — Pin dependencies + smoke harness

Branch: `chore/pin-deps-smoke-harness`, created from `docs/runtime-audit-spec` (stacked; PRs merge in order).

### Task 1: Pin and align dependency versions

**Files:**
- Modify: `package.json` (dependency specifiers only)

**Interfaces:**
- Consumes: nothing.
- Produces: a reproducible dependency set later tasks build on. No code API.

- [ ] **Step 1: Create the branch**

```bash
git checkout docs/runtime-audit-spec
git checkout -b chore/pin-deps-smoke-harness
```

- [ ] **Step 2: Replace every `latest` / stale-range specifier with an exact pin**

In `package.json` change exactly these lines (values from the recon block above — if `npm view <pkg> version` today returns something newer, use that and re-check `npm view @tanstack/react-start@<ver> dependencies` still pins the router version you install):

`dependencies`:

```json
"@tanstack/react-devtools": "0.10.8",
"@tanstack/react-form": "1.33.2",
"@tanstack/react-query": "5.101.2",
"@tanstack/react-query-devtools": "5.101.2",
"@tanstack/react-router": "1.170.18",
"@tanstack/react-router-devtools": "1.167.0",
"@tanstack/react-router-ssr-query": "1.167.1",
"@tanstack/react-start": "1.168.32",
"@tanstack/router-plugin": "1.168.23",
```

`devDependencies`:

```json
"@tanstack/devtools-vite": "0.8.1",
"@tanstack/eslint-config": "0.4.0",
"@tanstack/router-cli": "1.167.21",
```

- [ ] **Step 3: Decide nitro**

```bash
npm view nitro dist-tags
```

- If a stable `3.x` exists: `pnpm add -D nitro@<stable-version>`, then run `pnpm build`. If the build fails, restore `"nitro": "npm:nitro-nightly@3.0.1-20260717-080150-bfc2f5ef"` in `package.json` and note the failure for the PR body.
- If no stable `3.x` exists: keep the nightly pin exactly as is (it is already an exact version).

- [ ] **Step 4: Install and verify a single router copy**

```bash
pnpm install
pnpm why @tanstack/react-router
```

Expected: exactly one version, `1.170.18`, listed. If two versions appear, the start↔router pins disagree — fix the pins so `@tanstack/react-start`'s internal router pin equals the top-level router version, and reinstall.

- [ ] **Step 5: Run all gates**

```bash
pnpm lint
npx tsc --noEmit
pnpm build
pnpm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: pin and align TanStack dependency versions"
```

### Task 2: Seed module for smoke data

**Files:**
- Create: `scripts/smoke-seed.ts`

**Interfaces:**
- Consumes: `db` from `src/db/index.ts`, tables `itinerary`, `itineraryDay`, `stop`, `comment` from `src/db/schema.ts`.
- Produces: `ensureSmokeData(authorId: string): Promise<{ itineraryId: string; slug: string }>` — idempotent; creates (once) a published public itinerary owned by `authorId` with 1 day, 2 geolocated stops, and 1 comment. Also runnable directly (`pnpm exec tsx scripts/smoke-seed.ts`) as a DB-connectivity preflight.

- [ ] **Step 1: Write the module**

```ts
// scripts/smoke-seed.ts
import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { and, eq } from 'drizzle-orm'

import { db } from '../src/db/index.ts'
import { comment, itinerary, itineraryDay, stop } from '../src/db/schema.ts'

/**
 * Idempotent fixtures for the smoke harness (scripts/smoke.ts): one
 * published public itinerary owned by the smoke test user, with a day,
 * two geolocated stops (so the map/route surfaces render) and one
 * comment (so the SSR'd relative-time path renders). Runs under tsx,
 * outside Vite — must not import anything that pulls in src/env.ts.
 */
const SMOKE_TITLE = 'Smoke E2E Trip'
const SMOKE_COMMENT = 'Smoke harness comment — do not delete.'

export async function ensureSmokeData(
  authorId: string,
): Promise<{ itineraryId: string; slug: string }> {
  const existing = await db.query.itinerary.findFirst({
    where: and(eq(itinerary.authorId, authorId), eq(itinerary.title, SMOKE_TITLE)),
  })
  const record =
    existing ??
    (
      await db
        .insert(itinerary)
        .values({
          authorId,
          title: SMOKE_TITLE,
          slug: `smoke-e2e-trip-${authorId.slice(0, 8)}`,
          destination: 'Lisboa',
          status: 'published',
          publishedAt: new Date(),
        })
        .returning({ id: itinerary.id, slug: itinerary.slug })
    )[0]

  if (!existing) {
    const [day] = await db
      .insert(itineraryDay)
      .values({ itineraryId: record.id, dayNumber: 1, title: 'Day 1' })
      .returning({ id: itineraryDay.id })
    await db.insert(stop).values([
      {
        dayId: day.id,
        position: 1,
        name: 'Torre de Belém',
        category: 'attraction',
        lat: 38.6916,
        lng: -9.216,
      },
      {
        dayId: day.id,
        position: 2,
        name: 'Time Out Market',
        category: 'food',
        lat: 38.7071,
        lng: -9.1458,
      },
    ])
  }

  const existingComment = await db.query.comment.findFirst({
    where: and(eq(comment.itineraryId, record.id), eq(comment.body, SMOKE_COMMENT)),
  })
  if (!existingComment) {
    await db
      .insert(comment)
      .values({ itineraryId: record.id, authorId, body: SMOKE_COMMENT })
  }

  return { itineraryId: record.id, slug: record.slug }
}

// Direct invocation doubles as the DB preflight the harness needs.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const rows = await db.$count(itinerary)
  console.log(`db ok — ${rows} itineraries`)
  process.exit(0)
}
```

- [ ] **Step 2: Verify DB connectivity with it**

```bash
pnpm exec tsx scripts/smoke-seed.ts
```

Expected: `db ok — <N> itineraries`. If it fails with a connection error, STOP — ask the user to start the local Postgres from `.env`; do not proceed or work around it.

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit
pnpm lint
```

Expected: pass (tsconfig already includes `scripts/`). If `db.$count` does not exist on the installed Drizzle version, use `(await db.select({ id: itinerary.id }).from(itinerary)).length` instead.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-seed.ts
git commit -m "feat: idempotent smoke-data seed module"
```

### Task 3: Playwright smoke harness

**Files:**
- Create: `scripts/smoke.ts`
- Modify: `package.json` (devDependencies + scripts)

**Interfaces:**
- Consumes: `ensureSmokeData(authorId)` from `scripts/smoke-seed.ts` (exact signature above); Better Auth REST endpoints (recon block).
- Produces: `pnpm smoke` (dev server) and `pnpm smoke:preview` (`pnpm build` + `vite preview`, still port 3000). Exit code 0 ⇔ zero console errors across all covered routes. Output: per-route error/warning inventory on stdout.

- [ ] **Step 1: Install Playwright + Chromium**

```bash
pnpm add -D playwright@1.61.1
pnpm exec playwright install chromium
```

- [ ] **Step 2: Add npm scripts**

In `package.json` `scripts`:

```json
"smoke": "tsx scripts/smoke.ts",
"smoke:preview": "tsx scripts/smoke.ts --preview",
```

- [ ] **Step 3: Write the harness**

```ts
// scripts/smoke.ts
import 'dotenv/config'
import { execSync, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { chromium } from 'playwright'
import type { BrowserContext } from 'playwright'

import { ensureSmokeData } from './smoke-seed.ts'

/**
 * Browser smoke harness: walks every app route in headless Chromium
 * (anonymous and authenticated) and inventories console errors —
 * including React 19 hydration errors, which no static gate catches.
 * Serves on port 3000 in both modes because BETTER_AUTH_URL pins the
 * auth origin there. `--preview` builds first and serves the production
 * bundle, since hydration behavior differs from dev.
 */
const BASE_URL = 'http://localhost:3000'
const PREVIEW = process.argv.includes('--preview')
const SMOKE_USER = {
  name: 'Smoke Tester',
  email: 'smoke-e2e@example.com',
  password: 'smoke-e2e-password-123',
}

/** Dev-server noise that is not an app defect. Keep this list short and literal. */
const IGNORED = [/Download the React DevTools/i, /\[vite\] (connecting|connected)/i]

interface Finding {
  route: string
  kind: 'console-error' | 'console-warning' | 'pageerror' | 'requestfailed'
  text: string
}

function startServer(): ChildProcess {
  if (PREVIEW) {
    execSync('pnpm build', { stdio: 'inherit' })
    return spawn('pnpm', ['exec', 'vite', 'preview', '--port', '3000', '--strictPort'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  return spawn('pnpm', ['dev'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
}

function stopServer(proc: ChildProcess): void {
  if (process.platform === 'win32' && proc.pid) {
    try {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' })
    } catch {
      // already gone
    }
  } else {
    proc.kill('SIGTERM')
  }
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`server did not become ready at ${BASE_URL} within 120s`)
}

async function signIn(context: BrowserContext): Promise<string> {
  let res = await context.request.post('/api/auth/sign-up/email', { data: SMOKE_USER })
  if (!res.ok()) {
    res = await context.request.post('/api/auth/sign-in/email', {
      data: { email: SMOKE_USER.email, password: SMOKE_USER.password },
    })
  }
  if (!res.ok()) {
    throw new Error(`auth failed: ${res.status()} ${await res.text()}`)
  }
  const sessionRes = await context.request.get('/api/auth/get-session')
  const session = (await sessionRes.json()) as { user?: { id: string } } | null
  if (!session?.user?.id) {
    throw new Error('get-session returned no user after sign-in')
  }
  return session.user.id
}

async function visit(context: BrowserContext, route: string, label: string): Promise<Finding[]> {
  const findings: Finding[] = []
  const tag = `${route} (${label})`
  const page = await context.newPage()
  page.on('console', (msg) => {
    const text = msg.text()
    if (IGNORED.some((pattern) => pattern.test(text))) return
    if (msg.type() === 'error') findings.push({ route: tag, kind: 'console-error', text })
    if (msg.type() === 'warning') findings.push({ route: tag, kind: 'console-warning', text })
  })
  page.on('pageerror', (error) => {
    findings.push({ route: tag, kind: 'pageerror', text: error.message })
  })
  page.on('requestfailed', (request) => {
    findings.push({
      route: tag,
      kind: 'requestfailed',
      text: `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? '?'}`,
    })
  })
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'load', timeout: 60_000 })
  // Let hydration, effects, and streamed queries settle before judging.
  await page.waitForTimeout(4000)
  await page.close()
  return findings
}

const server = startServer()
try {
  await waitForServer()
  const browser = await chromium.launch()

  const authContext = await browser.newContext({ baseURL: BASE_URL })
  const userId = await signIn(authContext)
  const seeded = await ensureSmokeData(userId)

  const anonContext = await browser.newContext({ baseURL: BASE_URL })
  const anonRoutes = ['/', '/login', '/signup', '/forgot-password', '/explore', `/itineraries/${seeded.slug}`]
  const authRoutes = ['/my', '/new', `/my/${seeded.itineraryId}/edit`, `/itineraries/${seeded.slug}`]

  const findings: Finding[] = []
  for (const route of anonRoutes) findings.push(...(await visit(anonContext, route, 'anon')))
  for (const route of authRoutes) findings.push(...(await visit(authContext, route, 'auth')))

  await browser.close()

  const errors = findings.filter((finding) => finding.kind !== 'console-warning')
  const warnings = findings.filter((finding) => finding.kind === 'console-warning')
  const byRoute = new Map<string, Finding[]>()
  for (const finding of findings) {
    byRoute.set(finding.route, [...(byRoute.get(finding.route) ?? []), finding])
  }
  for (const [route, routeFindings] of byRoute) {
    console.log(`\n== ${route} ==`)
    for (const finding of routeFindings) console.log(`  [${finding.kind}] ${finding.text}`)
  }
  console.log(
    `\n${PREVIEW ? 'preview' : 'dev'}: ${errors.length} error(s), ${warnings.length} warning(s) across ${anonRoutes.length + authRoutes.length} route visits`,
  )
  process.exitCode = errors.length > 0 ? 1 : 0
} finally {
  stopServer(server)
}
process.exit(process.exitCode ?? 0)
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit
pnpm lint
```

Expected: pass.

- [ ] **Step 5: First diagnostic run**

```bash
pnpm smoke
```

Expected outcome is **either** exit 0 (no errors — then the user's errors live outside the covered routes; broaden by re-checking route list before concluding) **or** exit 1 with a per-route inventory. Exit 1 here is a successful diagnosis, not a task failure. Save the full output — Task 4 records it.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke.ts package.json pnpm-lock.yaml
git commit -m "feat: Playwright smoke harness inventorying browser console errors"
```

### Task 4: Record the inventory and open PR 1

**Files:**
- Create: `docs/superpowers/notes/2026-07-19-smoke-inventory.md`

**Interfaces:**
- Consumes: `pnpm smoke` / `pnpm smoke:preview` output.
- Produces: the inventory document PR 2's fix loop iterates over — one row per distinct error: route(s), exact message, suspected root cause, area/skill (per Task 6's map).

- [ ] **Step 1: Run both modes and capture output**

```bash
pnpm smoke > smoke-dev.log 2>&1
pnpm smoke:preview > smoke-preview.log 2>&1
```

(Exit 1 is expected; the logs are the artifact. Delete the two `.log` files after Step 2 — they do not get committed.)

- [ ] **Step 2: Write the inventory doc**

Structure (fill from the logs — every distinct error gets a row; group identical messages across routes):

```markdown
# Smoke inventory — 2026-07-19

| # | Route(s) | Kind | Message (verbatim, truncated to one line) | Suspected cause | Area / skill |
|---|----------|------|--------------------------------------------|-----------------|--------------|
| 1 | /itineraries/… (anon) | console-error | Hydration failed … | formatRelativeTime uses Date.now() | React/SSR |

## Warnings (triage in PR 2)
- …

## Dev-only vs preview-only differences
- …
```

- [ ] **Step 3: Commit and open PR 1**

```bash
git add docs/superpowers/notes/2026-07-19-smoke-inventory.md
git commit -m "docs: browser smoke-error inventory"
git push -u origin chore/pin-deps-smoke-harness
gh pr create --base main --title "chore: pin TanStack deps + Playwright smoke harness" --body "$(cat <<'EOF'
Pins every `latest` dependency to an exact, mutually compatible version (single router copy verified via `pnpm why`) and adds `pnpm smoke` / `pnpm smoke:preview`: a Playwright harness that seeds smoke data, walks all routes anonymous + authenticated, and inventories browser console errors. Inventory: docs/superpowers/notes/2026-07-19-smoke-inventory.md — fixed in the follow-up PR.

Part of the runtime audit (docs/superpowers/specs/2026-07-19-runtime-audit-design.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PxVA4CJpyu4fkkPmcHhNLi
EOF
)"
```

---

# PR 2 — Fix every inventoried error

Branch: `fix/runtime-console-errors`, created from `chore/pin-deps-smoke-harness`.

### Task 5: Make `formatRelativeTime` deterministic across SSR/hydration

**Files:**
- Create: `src/lib/relative-time.test.ts`
- Modify: `src/lib/relative-time.ts`
- Modify: `src/components/Comments.tsx:140`

**Interfaces:**
- Consumes: `commentsQuery` (`useInfiniteQuery` result) already in `Comments.tsx` — its `dataUpdatedAt: number` is part of dehydrated query state, so server and client share the same value.
- Produces: `formatRelativeTime(date: Date, locale: string, now: number = Date.now()): string` — third parameter added; existing two-arg callers keep working.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b fix/runtime-console-errors
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/relative-time.test.ts
import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './relative-time'

describe('formatRelativeTime', () => {
  it('is deterministic given an explicit reference timestamp', () => {
    const now = Date.parse('2026-07-19T12:00:00Z')
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoHoursAgo, 'en', now)).toBe('2 hours ago')
    expect(formatRelativeTime(twoHoursAgo, 'pt-BR', now)).toBe('há 2 horas')
  })

  it('defaults the reference to the current time', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinutesAgo, 'en')).toBe('5 minutes ago')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

```bash
pnpm test -- src/lib/relative-time.test.ts
```

Expected: FAIL — Vitest does not typecheck, so the extra argument is silently ignored by the current 2-arg implementation and the relative string is computed from the real clock (e.g. "11 hours ago"), not "2 hours ago".

- [ ] **Step 4: Implement**

In `src/lib/relative-time.ts` change the signature and the `Date.now()` line:

```ts
export function formatRelativeTime(
  date: Date,
  locale: string,
  // Explicit reference instant so SSR and hydration format the same
  // string — Date.now() differs between the two and mismatches.
  now: number = Date.now(),
): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  let duration = (date.getTime() - now) / 1000
```

(The rest of the function body is unchanged.)

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm test -- src/lib/relative-time.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Pass the shared timestamp at the SSR'd call site**

In `src/components/Comments.tsx` line 140, change:

```tsx
{formatRelativeTime(comment.createdAt, locale, commentsQuery.dataUpdatedAt)}
```

- [ ] **Step 7: Verify against the browser**

```bash
pnpm smoke
```

Expected: the hydration error on `/itineraries/<slug>` from the inventory is gone (other inventory errors may remain — they belong to Task 6).

- [ ] **Step 8: Gates and commit**

```bash
pnpm lint
npx tsc --noEmit
pnpm build
pnpm test
git add src/lib/relative-time.ts src/lib/relative-time.test.ts src/components/Comments.tsx
git commit -m "fix: comments relative time — Date.now() diverges between SSR and hydration"
```

### Task 6: Fix the remaining inventory errors, one commit each

**Files:**
- Modify: determined by `docs/superpowers/notes/2026-07-19-smoke-inventory.md` (from Task 4). Update the inventory doc's rows with `fixed: <commit>` as you go.

**Interfaces:**
- Consumes: the inventory doc; `pnpm smoke`.
- Produces: zero-error smoke runs; an updated inventory doc where every row is either `fixed: <sha>` or `deferred: <reason>` (warnings only — errors may not be deferred).

This task is a loop with a fixed procedure. For EACH remaining inventory row, in order:

- [ ] **Step 1: Reproduce** — run `pnpm smoke` and confirm the error still occurs on the listed route (earlier fixes or the dep pinning may have cleared it; if so mark the row `fixed: <ref>` and move on).
- [ ] **Step 2: Load the area's guidance BEFORE editing** — pick from this map (CLAUDE.md policy):

| Error area | Guidance to load |
|---|---|
| Hydration / SSR / `window` access / client-only surfaces | `pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/execution-model` |
| Router (navigation, loaders, params, SSR streaming) | matching `@tanstack/router-core#…` intent from AGENTS.md |
| Server functions / middleware | `pnpm dlx @tanstack/intent@latest load @tanstack/start-client-core#start-core/server-functions` |
| TanStack Query (SSR streaming, hydration of queries) | Context7: `resolve-library-id` "tanstack query" → `query-docs` with the error |
| Better Auth (session, sign-in flows) | `.claude/skills` better-auth skills |
| AI SDK (assistant streaming, useObject) | `ai-sdk` skill; `node_modules/ai/docs/` |
| shadcn/radix components | `shadcn` skill |
| Paraglide / i18n | Context7: "paraglide js" |
| React 19 patterns | `vercel-react-best-practices` skill |

- [ ] **Step 3: Root-cause and fix** — smallest change that removes the cause (not the symptom). UI copy through `m.*` only. No `suppressHydrationWarning` unless the mismatch is genuinely legitimate-by-design (document why in a code comment if so).
- [ ] **Step 4: Verify** — `pnpm smoke`: that row's error gone, no new findings.
- [ ] **Step 5: Commit** — `git add <files> && git commit -m "fix: <area> — <one-line cause>"`, update the inventory row with the sha.

After the loop, verify the spec's known-risk sites explicitly, even if no
inventory row pointed at them (absence from the inventory is evidence, not
proof — record the verdict for each in the inventory doc under a
"Known-risk sites" heading):

- [ ] `formatRelativeTime` — fixed in Task 5; confirm no other SSR'd call sites exist (`grep -rn "formatRelativeTime" src/`).
- [ ] `<html lang>` — `__root.tsx` `beforeLoad` mutates `document.documentElement` `lang` while SSR renders `lang={getLocale()}`; confirm no attribute-mismatch error appears on any route when the locale cookie is `pt-BR` (add a `visit` with a `PARAGLIDE_LOCALE=pt-BR` cookie to the harness if not already covered).
- [ ] `matchMedia`-gated surfaces (`useIsMobile`, `_app.explore.tsx:162`) — confirm SSR-false-then-effect pattern is intact and no mismatch is logged at both a 1280px and a 390px viewport (set `viewport` in the harness contexts if needed).
- [ ] maplibre + TanStack devtools — confirm neither logs errors during hydration on `/explore` and the detail page.

Loop exit criteria (all three):

```bash
pnpm smoke           # exit 0
pnpm smoke:preview   # exit 0
```

and every warning row in the inventory is `fixed:` or `deferred: <reason>`.

### Task 7: Gates and PR 2

- [ ] **Step 1: Full gates**

```bash
pnpm lint
npx tsc --noEmit
pnpm build
pnpm test
pnpm smoke
pnpm smoke:preview
```

Expected: all pass, both smoke runs exit 0.

- [ ] **Step 2: Commit the updated inventory + push + PR**

```bash
git add docs/superpowers/notes/2026-07-19-smoke-inventory.md
git commit -m "docs: mark smoke inventory rows fixed"
git push -u origin fix/runtime-console-errors
gh pr create --base chore/pin-deps-smoke-harness --title "fix: eliminate all browser console errors (hydration and runtime)" --body "$(cat <<'EOF'
Fixes every error in the smoke inventory at root cause — one commit per error, each verified by re-running `pnpm smoke`. Both `pnpm smoke` and `pnpm smoke:preview` now exit 0. Deferred warnings (if any) are listed in docs/superpowers/notes/2026-07-19-smoke-inventory.md with reasons.

Part of the runtime audit (docs/superpowers/specs/2026-07-19-runtime-audit-design.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PxVA4CJpyu4fkkPmcHhNLi
EOF
)"
```

---

# PR 3 — Targeted best-practices alignment

Branch: `refactor/best-practices-alignment`, created from `fix/runtime-console-errors`.

### Task 8: Align the areas PR 2 touched

**Files:**
- Modify: only files in areas PR 2 touched (list them with `git diff --name-only chore/pin-deps-smoke-harness...fix/runtime-console-errors -- src/`), plus the one standing item below.

**Interfaces:**
- Consumes: PR 2's diff; the skill map from Task 6.
- Produces: small alignment diffs, one commit per area; a "Reviewed, not changed" + "Out of scope" list for the PR body.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b refactor/best-practices-alignment
```

- [ ] **Step 2: Standing item — devtools in production**

Read `vite.config.ts`. Load `pnpm dlx @tanstack/intent@latest load @tanstack/devtools-vite#devtools-vite-plugin` and check the `@tanstack/devtools-vite` options against it. Then verify the production bundle:

```bash
pnpm build
grep -rl "TanStackDevtools" dist/client/assets | head -5
```

Expected: no matches (devtools stripped). If it matches, enable `removeDevtoolsOnBuild` per the intent guidance, rebuild, re-verify, and confirm `pnpm smoke:preview` still exits 0. Commit as `refactor: strip TanStack devtools from production bundle`.

- [ ] **Step 3: Per-area review loop**

For each area PR 2 touched: load that area's skill (Task 6 map, same commands), re-read the touched files against it, and apply only small, clearly-supported improvements — one commit per area, message `refactor: align <area> with <skill> guidance`. Real findings you deliberately don't fix go in a running list for the PR body under "Reviewed, not changed" (with reason) — that list is the deliverable for areas needing no change, not invented diffs.

- [ ] **Step 4: Verify nothing regressed after each area commit**

```bash
pnpm lint && npx tsc --noEmit && pnpm test && pnpm smoke
```

Expected: all pass after every commit.

### Task 9: Final verification and PR 3

- [ ] **Step 1: Full gate run**

```bash
pnpm lint
npx tsc --noEmit
pnpm build
pnpm test
pnpm smoke
pnpm smoke:preview
```

Expected: everything passes, both smoke runs exit 0.

- [ ] **Step 2: Push and open PR 3**

```bash
git push -u origin refactor/best-practices-alignment
gh pr create --base fix/runtime-console-errors --title "refactor: align error-adjacent areas with best-practices skills" --body "$(cat <<'EOF'
Targeted alignment pass over only the areas the runtime fixes touched, each reviewed against its skill/intent guidance. Includes the devtools-in-production check. "Reviewed, not changed" findings listed below.

<!-- paste the running list here -->

Part of the runtime audit (docs/superpowers/specs/2026-07-19-runtime-audit-design.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PxVA4CJpyu4fkkPmcHhNLi
EOF
)"
```

- [ ] **Step 3: Report to the user**

Summarize in the conversation: which errors existed (from the inventory), root cause of each, what was aligned in PR 3, what was deferred and why, and the merge order (docs → chore → fix → refactor).
