import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2Icon, MailCheckIcon } from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '#/lib/auth-client'
import { AuthField } from '#/components/auth/AuthField'
import { Button } from '#/components/ui/button'
import { FieldGroup } from '#/components/ui/field'
import { m } from '#/paraglide/messages'

/**
 * Requests a password-reset email. On success the form swaps to a
 * constant confirmation — the same message whether or not the address
 * exists (Better Auth already responds identically server-side; the UI
 * must not undo that enumeration defense).
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        toast.error(m.auth_error_generic())
        return
      }
      setSent(true)
    },
  })

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-surface p-6 text-center shadow-resting">
        <MailCheckIcon aria-hidden="true" className="size-6 text-mata" />
        <p className="text-body text-ink">{m.auth_forgot_sent()}</p>
        <p className="text-caption text-ink-soft">{m.auth_forgot_sent_hint()}</p>
      </div>
    )
  }

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
              {m.auth_forgot_submit()}
            </Button>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  )
}
