import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { authSearchSchema, safeRedirectTarget } from '#/lib/auth-redirect'
import { SignupForm } from '#/components/auth/SignupForm'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/signup')({
  validateSearch: authSearchSchema,
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>{m.auth_signup_title()}</CardTitle>
        </CardHeader>
        <CardContent>
          <SignupForm
            onSuccess={() => {
              void navigate({ to: safeRedirectTarget(redirect) })
            }}
          />
        </CardContent>
        <CardFooter>
          <Link
            to="/login"
            search={{ redirect }}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {m.auth_switch_to_login()}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
