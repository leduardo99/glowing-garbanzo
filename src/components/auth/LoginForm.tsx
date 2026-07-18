import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '#/lib/auth-client'
import { sessionQueryKey } from '#/lib/session'
import { AuthField } from '#/components/auth/AuthField'
import { Button } from '#/components/ui/button'
import { FieldGroup } from '#/components/ui/field'
import { m } from '#/paraglide/messages'

/**
 * The login form itself, decoupled from the `/login` route so it can be
 * unit-tested without a router. The route wraps this in `AuthShell` and
 * supplies `onSuccess` (navigates to the validated `redirect` search
 * param, see `src/lib/auth-redirect.ts`).
 */
export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: sessionQueryKey })
            onSuccess()
          },
          onError: () => {
            toast.error(m.auth_error_invalid())
          },
        },
      )
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) =>
              value ? undefined : m.auth_email_required(),
          }}
        >
          {(field) => (
            <AuthField
              field={field}
              label={m.auth_email()}
              type="email"
              autoComplete="email"
              inputMode="email"
            />
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) =>
              value ? undefined : m.auth_password_required(),
          }}
        >
          {(field) => (
            <AuthField
              field={field}
              label={m.auth_password()}
              type="password"
              autoComplete="current-password"
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="h-11 w-full text-label active:scale-[0.97]"
            >
              {isSubmitting && (
                <Loader2Icon className="size-4 animate-spin" />
              )}
              {m.auth_submit_login()}
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}
