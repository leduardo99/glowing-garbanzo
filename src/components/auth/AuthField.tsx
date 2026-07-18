import type { AnyFieldApi } from '@tanstack/react-form'

import { Field, FieldError, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'

/**
 * A single text/email/password field wired to a TanStack Form field,
 * shared by the login and signup forms. Field-level errors come from the
 * field's `onChange` validator (see `login.tsx` / `signup.tsx`).
 */
export function AuthField({
  field,
  label,
  type,
  autoComplete,
}: {
  field: AnyFieldApi
  label: string
  type: 'email' | 'password' | 'text'
  autoComplete: string
}) {
  const errors = field.state.meta.errors.filter(
    (error: unknown): error is string =>
      typeof error === 'string' && error.length > 0,
  )

  return (
    <Field data-invalid={errors.length > 0 || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        autoComplete={autoComplete}
        value={field.state.value}
        aria-invalid={errors.length > 0}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      <FieldError errors={errors.map((message) => ({ message }))} />
    </Field>
  )
}
