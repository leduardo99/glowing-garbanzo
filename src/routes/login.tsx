import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { authSearchSchema, safeRedirectTarget } from '#/lib/auth-redirect'
import { LoginForm } from '#/components/auth/LoginForm'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>{m.auth_login_title()}</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm
            onSuccess={() => {
              void navigate({ to: safeRedirectTarget(redirect) })
            }}
          />
        </CardContent>
        <CardFooter>
          <Link
            to="/signup"
            search={{ redirect }}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {m.auth_switch_to_signup()}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
