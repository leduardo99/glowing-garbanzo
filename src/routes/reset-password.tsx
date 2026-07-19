import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { AuthShell } from '#/components/auth/AuthShell'
import { ResetPasswordForm } from '#/components/auth/ResetPasswordForm'
import { m } from '#/paraglide/messages'

/**
 * Landing spot for the email's reset link: Better Auth validates the
 * token server-side and redirects here with `?token=…` (or `?error=…`
 * when the link is expired/used — rendered as the invalid state).
 */
export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({
    token: z.string().optional(),
    error: z.string().optional(),
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { token, error } = Route.useSearch()

  return (
    <AuthShell
      welcome={m.auth_reset_welcome()}
      footer={
        <Link
          to="/login"
          className="text-label text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          {m.auth_back_to_login()}
        </Link>
      }
    >
      <h2 className="sr-only">{m.auth_reset_title()}</h2>
      {token && !error ? (
        <ResetPasswordForm
          token={token}
          onSuccess={() => {
            void navigate({ to: '/login' })
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-6 text-center shadow-resting">
          <p className="text-body text-ink">{m.auth_reset_link_invalid()}</p>
          <Link to="/forgot-password" className="text-label font-medium">
            {m.auth_reset_request_again()}
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
