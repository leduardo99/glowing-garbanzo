import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { authSearchSchema, safeRedirectTarget } from '#/lib/auth-redirect'
import { AuthShell } from '#/components/auth/AuthShell'
import { LoginForm } from '#/components/auth/LoginForm'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()

  return (
    <AuthShell
      welcome={m.auth_login_welcome()}
      footer={
        <Link
          to="/signup"
          search={{ redirect }}
          className="text-label text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          {m.auth_switch_to_signup()}
        </Link>
      }
    >
      <h2 className="sr-only">{m.auth_login_title()}</h2>
      <LoginForm
        onSuccess={() => {
          void navigate({ to: safeRedirectTarget(redirect) })
        }}
      />
    </AuthShell>
  )
}
