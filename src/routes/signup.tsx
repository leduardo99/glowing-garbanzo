import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { authSearchSchema, safeRedirectTarget } from '#/lib/auth-redirect'
import { AuthShell } from '#/components/auth/AuthShell'
import { SignupForm } from '#/components/auth/SignupForm'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/signup')({
  validateSearch: authSearchSchema,
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()

  return (
    <AuthShell
      welcome={m.auth_signup_welcome()}
      footer={
        <Link
          to="/login"
          search={{ redirect }}
          className="text-label text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          {m.auth_switch_to_login()}
        </Link>
      }
    >
      <h2 className="sr-only">{m.auth_signup_title()}</h2>
      <SignupForm
        onSuccess={() => {
          void navigate({ to: safeRedirectTarget(redirect) })
        }}
      />
    </AuthShell>
  )
}
