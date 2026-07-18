import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { LogOutIcon } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { sessionQueryKey } from '#/lib/session'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Skeleton } from '#/components/ui/skeleton'
import LocaleSwitcher from '#/components/LocaleSwitcher'
import { m } from '#/paraglide/messages'

/**
 * Site header: app name, locale switcher, and a session-dependent area
 * (login button for anonymous visitors, avatar dropdown for signed-in
 * users). Reads the session from `authClient.useSession()` (client-side,
 * reactive) rather than the root route's `context.session` — that context
 * value is SSR-derived and meant for protected-route `beforeLoad` guards,
 * not for keeping this header in sync immediately after a client-side
 * sign-in/sign-out.
 */
export function AppHeader() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session, isPending } = authClient.useSession()

  async function handleLogout() {
    await authClient.signOut()
    await queryClient.invalidateQueries({ queryKey: sessionQueryKey })
    await router.invalidate()
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
      <Link to="/" className="text-lg font-semibold">
        {m.app_name()}
      </Link>

      <div className="flex items-center gap-4">
        <LocaleSwitcher />

        {isPending ? (
          <Skeleton className="size-9 rounded-full" />
        ) : session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
                <Avatar size="sm">
                  <AvatarImage src={session.user.image ?? undefined} alt="" />
                  <AvatarFallback>
                    {session.user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {session.user.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="truncate">
                {session.user.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {/*
                  `/my` is created in a later task — a plain anchor keeps
                  this link buildable (and 404-able) before that route
                  tree entry exists; swap for a typed `Link` once it does.
                */}
                <DropdownMenuItem asChild>
                  <a href="/my">{m.nav_my_itineraries()}</a>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => void handleLogout()}
              >
                <LogOutIcon data-icon="inline-start" />
                {m.auth_logout()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm">
            <Link to="/login">{m.auth_login_title()}</Link>
          </Button>
        )}
      </div>
    </header>
  )
}
