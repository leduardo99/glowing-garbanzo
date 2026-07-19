import { useForm } from '@tanstack/react-form'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '#/lib/auth-client'
import { AuthField } from '#/components/auth/AuthField'
import { Button } from '#/components/ui/button'
import { FieldGroup } from '#/components/ui/field'
import { m } from '#/paraglide/messages'

const MIN_PASSWORD_LENGTH = 8

/**
 * Sets the new password from a reset link. The single-use `token` comes
 * from the email link's redirect (`/reset-password?token=…`); an expired
 * or already-used token surfaces as a toast and the user can restart from
 * `/forgot-password`.
 */
export function ResetPasswordForm({
  token,
  onSuccess,
}: {
  token: string
  onSuccess: () => void
}) {
  const form = useForm({
    defaultValues: { password: '', confirm: '' },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.resetPassword({
        newPassword: value.password,
        token,
      })
      if (error) {
        toast.error(m.auth_reset_invalid())
        return
      }
      toast.success(m.auth_reset_success())
      onSuccess()
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
          name="password"
          validators={{
            onChange: ({ value }) =>
              value.length >= MIN_PASSWORD_LENGTH
                ? undefined
                : m.auth_password_min({ min: MIN_PASSWORD_LENGTH }),
          }}
        >
          {(field) => (
            <AuthField
              field={field}
              label={m.auth_new_password()}
              type="password"
              autoComplete="new-password"
            />
          )}
        </form.Field>

        <form.Field
          name="confirm"
          validators={{
            onChangeListenTo: ['password'],
            onChange: ({ value, fieldApi }) =>
              value === fieldApi.form.getFieldValue('password')
                ? undefined
                : m.auth_password_mismatch(),
          }}
        >
          {(field) => (
            <AuthField
              field={field}
              label={m.auth_confirm_password()}
              type="password"
              autoComplete="new-password"
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
              {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
              {m.auth_reset_submit()}
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}
