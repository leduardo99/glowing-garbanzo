import { useForm } from '@tanstack/react-form'
import type { AnyFieldApi } from '@tanstack/react-form'

import { parseCostToCents } from '#/lib/cost'
import { Button } from '#/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { m } from '#/paraglide/messages'
import type { StopView } from '#/server/itineraries'

type StopCategory = StopView['category']

/** Editable field values as the form holds them — `cost` is the raw typed string, converted to cents on submit. */
export interface StopFormValues {
  name: string
  category: StopCategory
  description: string
  cost: string
  placeLabel: string
}

/** Shape handed to `onSubmit` — matches `addStop`/`updateStop`'s input fields (minus `dayId`/`id`, which the caller already knows). */
export interface StopFormSubmitValues {
  name: string
  category: StopCategory
  description: string | null
  costCents: number | null
  placeLabel: string | null
}

const CATEGORY_LABEL: Record<StopCategory, () => string> = {
  attraction: m.stop_category_attraction,
  food: m.stop_category_food,
  lodging: m.stop_category_lodging,
  transport: m.stop_category_transport,
  other: m.stop_category_other,
}

const CATEGORIES: StopCategory[] = [
  'attraction',
  'food',
  'lodging',
  'transport',
  'other',
]

export const EMPTY_STOP_FORM_VALUES: StopFormValues = {
  name: '',
  category: 'attraction',
  description: '',
  cost: '',
  placeLabel: '',
}

function fieldErrors(field: AnyFieldApi): string[] {
  return field.state.meta.errors.filter(
    (error: unknown): error is string =>
      typeof error === 'string' && error.length > 0,
  )
}

/**
 * Add/edit form for a single stop. Presentational and self-contained (no
 * routing or query dependencies), so it renders and is testable without a
 * router/query client — `DayEditor` supplies `defaultValues` for edit mode
 * and performs the actual `addStop`/`updateStop` mutation from `onSubmit`.
 */
export function StopForm({
  defaultValues = EMPTY_STOP_FORM_VALUES,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues?: StopFormValues
  onSubmit: (values: StopFormSubmitValues) => void | Promise<void>
  onCancel?: () => void
  submitLabel: string
}) {
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await onSubmit({
        name: value.name.trim(),
        category: value.category,
        description: value.description.trim() || null,
        costCents: parseCostToCents(value.cost),
        placeLabel: value.placeLabel.trim() || null,
      })
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
          name="name"
          validators={{
            onChange: ({ value }) =>
              value.trim() ? undefined : m.editor_stop_name_required(),
          }}
        >
          {(field) => {
            const errors = fieldErrors(field)
            return (
              <Field data-invalid={errors.length > 0 || undefined}>
                <FieldLabel htmlFor={field.name}>
                  {m.editor_stop_field_name()}
                </FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  aria-invalid={errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <FieldError errors={errors.map((message) => ({ message }))} />
              </Field>
            )
          }}
        </form.Field>

        <form.Field name="category">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {m.editor_stop_field_category()}
              </FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(value) =>
                  field.handleChange(value as StopCategory)
                }
              >
                <SelectTrigger id={field.name} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CATEGORY_LABEL[category]()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {m.editor_stop_field_description()}
              </FieldLabel>
              <Textarea
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field
          name="cost"
          validators={{
            onChange: ({ value }) =>
              value.trim() && parseCostToCents(value) === null
                ? m.editor_stop_cost_invalid()
                : undefined,
          }}
        >
          {(field) => {
            const errors = fieldErrors(field)
            return (
              <Field data-invalid={errors.length > 0 || undefined}>
                <FieldLabel htmlFor={field.name}>
                  {m.editor_stop_field_cost()}
                </FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  inputMode="decimal"
                  placeholder={m.editor_stop_field_cost_placeholder()}
                  value={field.state.value}
                  aria-invalid={errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <FieldError errors={errors.map((message) => ({ message }))} />
              </Field>
            )
          }}
        </form.Field>

        <form.Field name="placeLabel">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {m.editor_stop_field_place()}
              </FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </form.Field>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              {m.editor_stop_cancel()}
            </Button>
          ) : null}
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {submitLabel}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </FieldGroup>
    </form>
  )
}
