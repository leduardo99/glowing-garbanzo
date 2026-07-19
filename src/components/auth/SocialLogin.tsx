import { useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

/** Google's four-color G — fixed brand colors, not theme tokens. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.16 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.44 1.14-4.08 1.14-3.13 0-5.78-2.11-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.28a12.02 12.02 0 0 0 0 10.74l3.99-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 1.28 6.63l3.99 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  )
}

/**
 * "ou continue com" divider + Google button, rendered by the login and
 * signup pages only when the deployment has Google credentials
 * (`getAuthCapabilities` — see src/lib/auth.ts). The OAuth flow is a full
 * redirect, so there is no onSuccess wiring: Better Auth lands the user
 * back on `callbackURL` with the session cookie already set.
 */
export function SocialLogin({ callbackPath }: { callbackPath: string }) {
  const [pending, setPending] = useState(false)

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div
        aria-hidden="true"
        className="flex items-center gap-3 text-caption text-ink-soft"
      >
        <span className="h-px flex-1 bg-line" />
        {m.auth_or_continue_with()}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="h-11 w-full text-label"
        onClick={() => {
          setPending(true)
          void authClient
            .signIn.social({
              provider: 'google',
              callbackURL: `${window.location.origin}${callbackPath}`,
            })
            .catch(() => {
              setPending(false)
              toast.error(m.auth_error_generic())
            })
        }}
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <GoogleGlyph />
        )}
        {m.auth_google_button()}
      </Button>
    </div>
  )
}
