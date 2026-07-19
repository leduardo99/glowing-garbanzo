import { createFileRoute, Link, redirect } from '@tanstack/react-router'

import { AuthShell } from '#/components/auth/AuthShell'
import { ForgotPasswordForm } from '#/components/auth/ForgotPasswordForm'
import { getAuthCapabilities } from '#/server/auth'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/forgot-password')({
  loader: async () => {
    const capabilities = await getAuthCapabilities()
    // Without an email provider the reset flow can't complete — the login
    // page hides its entry link, and a direct visit lands back on /login.
    if (!capabilities.passwordReset) {
      throw redirect({ to: '/login' })
    }
  },
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <AuthShell
      welcome={m.auth_forgot_welcome()}
      footer={
        <Link
          to="/login"
          className="text-label text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          {m.auth_back_to_login()}
        </Link>
      }
    >
      <h2 className="sr-only">{m.auth_forgot_title()}</h2>
      <ForgotPasswordForm />
    </AuthShell>
  )
}
