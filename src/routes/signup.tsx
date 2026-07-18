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
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-sm flex-col justify-center gap-6 p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-headline">
            {m.auth_signup_title()}
          </CardTitle>
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
            className="text-label text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            {m.auth_switch_to_login()}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
