import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { LogOutIcon, UserIcon } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { sessionQueryKey } from '#/lib/session'
import { tabLinkClassName } from '#/components/navigation/tabLinkClassName'
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
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/**
 * Session-dependent account area: an avatar dropdown (My itineraries, New
 * itinerary, Logout) for signed-in users, or a login link for anonymous
 * visitors. Reads the session from `authClient.useSession()` directly
 * (client-side, reactive) rather than taking it as a prop — both
 * `AppHeader` (`variant="header"`) and `BottomNav` (`variant="tab"`) render
 * this component independently instead of threading session state down
 * through props.
 */
export function UserMenu({ variant }: { variant: 'header' | 'tab' }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session, isPending } = authClient.useSession()

  async function handleLogout() {
    await authClient.signOut()
    await queryClient.invalidateQueries({ queryKey: sessionQueryKey })
    await router.invalidate()
  }

  if (isPending) {
    // Tab variant mirrors `tabLinkClassName`'s box (flex-1, centered) so
    // the loading state occupies the exact same slot the avatar/login
    // link renders into once the session resolves — otherwise the
    // skeleton (having no flex-1 sizing of its own) would sit narrower
    // and off-baseline versus the other three tabs for a frame.
    return variant === 'header' ? (
      <Skeleton className="size-9 rounded-full" />
    ) : (
      <div className={tabLinkClassName} aria-hidden="true">
        <Skeleton className="size-6 rounded-full" />
      </div>
    )
  }

  if (!session?.user) {
    if (variant === 'tab') {
      return (
        <Link to="/login" className={tabLinkClassName}>
          <UserIcon className="size-6" aria-hidden="true" />
          <span className="text-[11px] font-medium">
            {m.auth_login_title()}
          </span>
        </Link>
      )
    }
    // Anonymous desktop header: signup is the primary action, login the
    // quiet one — the landing page's conversion pair, repeated in chrome.
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">{m.auth_login_title()}</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/signup">{m.landing_cta_signup()}</Link>
        </Button>
      </div>
    )
  }

  const initial = session.user.name.charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'tab' ? (
          <button
            type="button"
            className={cn(tabLinkClassName, 'outline-none')}
            aria-label={m.nav_profile()}
          >
            <Avatar size="sm">
              <AvatarImage src={session.user.image ?? undefined} alt="" />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <span className="text-[11px] font-medium">{m.nav_profile()}</span>
          </button>
        ) : (
          <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
            <Avatar size="sm">
              <AvatarImage src={session.user.image ?? undefined} alt="" />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{session.user.name}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={variant === 'tab' ? 'top' : 'bottom'}
        className={cn(variant === 'tab' && 'mb-2')}
      >
        <DropdownMenuLabel className="truncate">
          {session.user.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/my">{m.nav_my_itineraries()}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/new">{m.nav_new_itinerary()}</Link>
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
  )
}
