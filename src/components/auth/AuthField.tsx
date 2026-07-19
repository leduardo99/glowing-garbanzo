import type { ComponentProps } from 'react'
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
  inputMode,
}: {
  field: AnyFieldApi
  label: string
  type: 'email' | 'password' | 'text'
  autoComplete: string
  /** e.g. `"email"` to surface the @ key on mobile keyboards. */
  inputMode?: ComponentProps<'input'>['inputMode']
}) {
  const errors = field.state.meta.errors.filter(
    (error: unknown): error is string =>
      typeof error === 'string' && error.length > 0,
  )

  return (
    <Field data-invalid={errors.length > 0 || undefined}>
      {/*
        No explicit text color here: `Field`'s `data-invalid=true` sets
        `text-destructive` on the wrapping group, and this label inherits
        it (DESIGN.md's input error spec: "border and label switch to
        destructive") rather than fighting it with a hardcoded ink class.
      */}
      <FieldLabel htmlFor={field.name} className="text-label font-medium">
        {label}
      </FieldLabel>
      {/*
        44px height (`h-11`), surface-sunken + line border + 6px radius per
        DESIGN.md's Input spec — the 40px token height is bumped up here
        specifically to clear PRODUCT.md's ≥44px touch-target rule, since
        this is the one place a visitor's very first tap on the app lands.
      */}
      <Input
        id={field.name}
        name={field.name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={field.state.value}
        aria-invalid={errors.length > 0}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        className="h-11 rounded-sm border-line bg-surface-sunken text-body focus-visible:border-mata"
      />
      <FieldError
        errors={errors.map((message) => ({ message }))}
        className="text-label"
      />
    </Field>
  )
}
