import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { getLocale } from '#/paraglide/runtime'
import { AppHeader } from '#/components/AppHeader'
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
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        <AppHeader />
        {children}
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
        <Scripts />
      </body>
    </html>
  )
}
