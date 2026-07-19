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
const IGNORED = [
  /Download the React DevTools/i,
  /\[vite\] (connecting|connected)/i,
]

interface Finding {
  route: string
  kind: 'console-error' | 'console-warning' | 'pageerror' | 'requestfailed'
  text: string
}

/**
 * The dev/preview server's stdout/stderr are piped (not inherited) so its
 * chatter doesn't interleave with the per-route findings printed below —
 * but an unread pipe fills its OS buffer once the app logs enough (e.g. a
 * hydration-error flood, which is exactly what this harness is looking
 * for), and the server then blocks on the write, stalling every
 * in-flight request. Drain both streams so that can't happen.
 */
function drainOutput(proc: ChildProcess): void {
  proc.stdout?.on('data', () => {})
  proc.stderr?.on('data', () => {})
}

function startServer(): ChildProcess {
  if (PREVIEW) {
    execSync('pnpm build', { stdio: 'inherit' })
    // A single command string (not a separate `args` array) with
    // `shell: true`: Node deprecated passing `args` alongside `shell: true`
    // (DEP0190, as of Node 22+) because array-form args aren't escaped for
    // the shell they're handed to. `shell: true` itself still has to stay —
    // on Windows, `pnpm` resolves to a `.cmd` shim that only cmd.exe/a shell
    // can execute directly; spawning it without a shell fails outright.
    // Every value below is a literal, not interpolated input, so folding
    // them into one string carries no injection risk.
    const proc = spawn('pnpm exec vite preview --port 3000 --strictPort', {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    drainOutput(proc)
    return proc
  }
  const proc = spawn('pnpm dev', {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  drainOutput(proc)
  return proc
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
  let res = await context.request.post('/api/auth/sign-up/email', {
    data: SMOKE_USER,
  })
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

async function visit(
  context: BrowserContext,
  route: string,
  label: string,
): Promise<Finding[]> {
  const findings: Finding[] = []
  const tag = `${route} (${label})`
  const page = await context.newPage()
  page.on('console', (msg) => {
    const text = msg.text()
    if (IGNORED.some((pattern) => pattern.test(text))) return
    if (msg.type() === 'error')
      findings.push({ route: tag, kind: 'console-error', text })
    if (msg.type() === 'warning')
      findings.push({ route: tag, kind: 'console-warning', text })
  })
  page.on('pageerror', (error) => {
    findings.push({ route: tag, kind: 'pageerror', text: error.message })
  })
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? '?'
    // `net::ERR_ABORTED` is Chromium's signal that the *browser* canceled
    // the request — via navigation, an app-level AbortController (e.g.
    // TanStack Query dropping a stale fetch), or `page.close()` below —
    // not a network/server failure. Routes with live external resources
    // (maplibre tiles on /explore) routinely still have requests in
    // flight when the 4s settle window ends and the page closes; that's
    // expected browser behavior, not an app defect, and reporting it as
    // one is a flaky false positive. Genuine failures (DNS, timeout,
    // connection refused, blocked) use other `net::ERR_*` codes and are
    // still reported below.
    if (errorText === 'net::ERR_ABORTED') return
    findings.push({
      route: tag,
      kind: 'requestfailed',
      text: `${request.method()} ${request.url()} — ${errorText}`,
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
  const anonRoutes = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/explore',
    `/itineraries/${seeded.slug}`,
  ]
  const authRoutes = [
    '/my',
    '/new',
    `/my/${seeded.itineraryId}/edit`,
    `/itineraries/${seeded.slug}`,
  ]

  // Known-risk coverage (see docs/superpowers/notes/2026-07-19-smoke-inventory.md
  // "Known-risk sites"): the routes above never set a locale cookie, so
  // getLocale() falls through the ['cookie', 'baseLocale'] strategy to
  // baseLocale ('pt-BR') — exercising the *fallback* path, not the cookie
  // read itself. This context sets PARAGLIDE_LOCALE explicitly so the
  // cookie-parsing code path (extractLocaleFromCookie /
  // extractLocaleFromRequestWithStrategies) actually runs, covering the
  // __root.tsx <html lang> risk (SSR's lang={getLocale()} vs beforeLoad's
  // imperative document.documentElement.setAttribute('lang', ...)).
  const ptBrCookieContext = await browser.newContext({ baseURL: BASE_URL })
  await ptBrCookieContext.addCookies([
    { name: 'PARAGLIDE_LOCALE', value: 'pt-BR', url: BASE_URL },
  ])

  // Known-risk coverage: matchMedia-gated surfaces (useIsMobile,
  // _app.explore.tsx's useIsDesktop) default to `false` on the server and
  // first client render, then correct via a post-hydration effect — safe
  // by construction at any width, but only the routes that actually branch
  // on them (`/explore`'s map-vs-list layout, `/itineraries/$slug`'s
  // ResponsiveSheet) exercise the mobile component tree at all. The
  // anon/auth contexts above run at Chromium's default 1280x720; this one
  // adds the 390px phone width those routes are designed for.
  const mobileViewportContext = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 390, height: 844 },
  })

  const findings: Finding[] = []
  for (const route of anonRoutes)
    findings.push(...(await visit(anonContext, route, 'anon')))
  for (const route of authRoutes)
    findings.push(...(await visit(authContext, route, 'auth')))
  findings.push(...(await visit(ptBrCookieContext, '/', 'pt-BR-cookie')))
  const mobileRoutes = ['/explore', `/itineraries/${seeded.slug}`]
  for (const route of mobileRoutes)
    findings.push(...(await visit(mobileViewportContext, route, 'mobile-390')))

  await browser.close()

  const errors = findings.filter(
    (finding) => finding.kind !== 'console-warning',
  )
  const warnings = findings.filter(
    (finding) => finding.kind === 'console-warning',
  )
  const byRoute = new Map<string, Finding[]>()
  for (const finding of findings) {
    byRoute.set(finding.route, [...(byRoute.get(finding.route) ?? []), finding])
  }
  for (const [route, routeFindings] of byRoute) {
    console.log(`\n== ${route} ==`)
    for (const finding of routeFindings)
      console.log(`  [${finding.kind}] ${finding.text}`)
  }
  const totalVisits =
    anonRoutes.length + authRoutes.length + 1 + mobileRoutes.length
  console.log(
    `\n${PREVIEW ? 'preview' : 'dev'}: ${errors.length} error(s), ${warnings.length} warning(s) across ${totalVisits} route visits`,
  )
  process.exitCode = errors.length > 0 ? 1 : 0
} finally {
  stopServer(server)
}
process.exit(process.exitCode)
