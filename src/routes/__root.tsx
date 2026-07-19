import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { getLocale } from '#/paraglide/runtime'
import { useIsChromelessRoute } from '#/lib/chromeless'
import { AppHeader } from '#/components/AppHeader'
import { BottomNav } from '#/components/navigation/BottomNav'
import { PwaRegister } from '#/components/PwaRegister'
import { Toaster } from '#/components/ui/sonner'
import { sessionQueryKey } from '#/lib/session'
import { getSessionUser } from '#/server/auth'
import type { SessionUserView } from '#/server/auth'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

/**
 * Router context contributed by this route's `beforeLoad` (merged into
 * `context` for every descendant route, on top of `MyRouterContext`).
 * Protected routes (`/new`, `/my/*` — added in a later task) read
 * `context.session` in their own `beforeLoad` and redirect to
 * `/login?redirect=` when it's `null`.
 */
interface RootContext {
  session: SessionUserView | null
}

/** How long a cached session lookup is considered fresh before `beforeLoad` re-fetches it. */
const SESSION_STALE_TIME_MS = 5 * 60_000

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context }): Promise<RootContext> => {
    // Other redirect strategies are possible; see
    // https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#offline-redirect
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', getLocale())
    }
    // Routed through the query client so client-side navigations reuse the
    // cached session instead of paying a network round-trip on every
    // route change. Auth-state changes (login/signup/logout) invalidate
    // `sessionQueryKey` so the header/guards see fresh state immediately.
    const session = await context.queryClient.fetchQuery({
      queryKey: sessionQueryKey,
      queryFn: () => getSessionUser(),
      staleTime: SESSION_STALE_TIME_MS,
    })
    return { session }
  },

  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        // `viewport-fit=cover` lets the page extend under the notch/home
        // indicator so `env(safe-area-inset-*)` (used by BottomNav) has
        // real insets to read instead of 0 — see .interface-design/system.md.
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: 'Roteiros',
      },
      // Two theme-color tags (light/dark) instead of one so the browser
      // chrome/status bar matches the app shell's surface color in both
      // themes — DESIGN.md §2 surface tokens, converted to sRGB hex since
      // theme-color support for oklch() isn't universal yet.
      {
        name: 'theme-color',
        content: '#f9f5ef',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#0b1510',
        media: '(prefers-color-scheme: dark)',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Roteiros',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        // A dedicated 180px, opaque-background icon — iOS Safari reads
        // this tag directly for the home-screen icon rather than the web
        // manifest's icon list, and renders any PNG alpha as solid black,
        // so this can't reuse the transparent `logo192.png`.
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  shellComponent: RootDocument,
})

/**
 * Reserves room for BottomNav's fixed bar on mobile (it would otherwise
 * overlap the last bit of page content) — matches the bar's own
 * `h-[calc(4rem+env(safe-area-inset-bottom))]` exactly (BottomNav.tsx).
 * BottomNav is `md:hidden`, so the padding drops in lockstep at the same
 * breakpoint — and drops entirely on chromeless routes (auth, landing),
 * where the bar itself doesn't render and the padding would read as a
 * dead strip below their own footers.
 */
function ContentFrame({ children }: { children: React.ReactNode }) {
  const chromeless = useIsChromelessRoute()
  return (
    <div
      className={
        chromeless
          ? undefined
          : 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0'
      }
    >
      {children}
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the ScriptOnce below adds `.dark` to <html>
    // BEFORE React hydrates, so for dark-scheme users the client attribute
    // set never matches the SSR'd one. Without the suppression React 19
    // reports a recoverable-but-noisy hydration error on every page and,
    // depending on streaming timing, can leave the tree unhydrated —
    // dead dropdowns, dead client-side navigation. Scoped to this element
    // only; content mismatches elsewhere still surface normally.
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/*
          Theme is class-driven (`.dark` on <html>, see styles.css) and
          follows the system preference. Applied in a blocking inline
          script so the very first paint is already themed — a media-query-
          only approach was rejected because the `dark:` Tailwind variant
          and any future manual toggle both need the class. The listener
          keeps a long-lived tab in sync when the OS switches themes.
        */}
        <ScriptOnce>
          {`(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(){document.documentElement.classList.toggle('dark',m.matches)};apply();m.addEventListener('change',apply)})()`}
        </ScriptOnce>
      </head>
      <body>
        {/*
          NuqsAdapter wires `useQueryState`/`useQueryStates` (see the home
          route) to TanStack Router's actual `navigate()` — URL-state
          updates still flow through the router (so route `loaderDeps` /
          `loader` keep re-running the same way they did with hand-rolled
          `Route.useNavigate()` calls), nuqs just adds typed parsing,
          debouncing, and default-clearing on top. Must live inside the
          router-provided tree, so it wraps `children` here rather than
          living in `router.tsx`.
        */}
        <NuqsAdapter>
          <AppHeader />
          <ContentFrame>{children}</ContentFrame>
          <BottomNav />
          <PwaRegister />
          <Toaster />
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        </NuqsAdapter>
        <Scripts />
      </body>
    </html>
  )
}
