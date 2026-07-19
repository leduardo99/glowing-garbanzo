import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { authSearchSchema, safeRedirectTarget } from '#/lib/auth-redirect'
import { AuthShell } from '#/components/auth/AuthShell'
import { LoginForm } from '#/components/auth/LoginForm'
import { SocialLogin } from '#/components/auth/SocialLogin'
import { getAuthCapabilities } from '#/server/auth'
import { getCommunityStats } from '#/server/community'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  loader: async () => {
    const [capabilities, stats] = await Promise.all([
      getAuthCapabilities(),
      getCommunityStats(),
    ])
    return { capabilities, stats }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const { capabilities, stats } = Route.useLoaderData()

  return (
    <AuthShell
      welcome={m.auth_login_welcome()}
      stats={stats}
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
      {capabilities.passwordReset ? (
        <div className="mt-3 text-right">
          <Link
            to="/forgot-password"
            className="text-label text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            {m.auth_forgot_link()}
          </Link>
        </div>
      ) : null}
      {capabilities.googleLogin ? (
        <SocialLogin callbackPath={safeRedirectTarget(redirect)} />
      ) : null}
    </AuthShell>
  )
}
