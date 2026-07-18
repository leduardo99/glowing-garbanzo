import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { m } from '#/paraglide/messages'
import { createItinerary } from '#/server/itineraries'
import type { CreateItineraryInput } from '#/server/itineraries'

export const Route = createFileRoute('/new')({
  beforeLoad: ({ context, location }) => {
    if (!context.session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: NewItineraryPage,
})

function NewItineraryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (input: CreateItineraryInput) =>
      createItinerary({ data: input }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'itineraries',
      })
      void navigate({ to: '/my/$id/edit', params: { id: result.id } })
    },
    onError: () => toast.error(m.new_error()),
  })

  const form = useForm({
    defaultValues: { title: '', destination: '' },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value)
    },
  })

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>{m.new_title()}</CardTitle>
          <CardDescription>{m.new_description()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <FieldGroup>
              <form.Field
                name="title"
                validators={{
                  onChange: ({ value }) =>
                    value.trim() ? undefined : m.editor_title_required(),
                }}
              >
                {(field) => {
                  const errors = field.state.meta.errors.filter(
                    (error: unknown): error is string =>
                      typeof error === 'string' && error.length > 0,
                  )
                  return (
                    <Field data-invalid={errors.length > 0 || undefined}>
                      <FieldLabel htmlFor={field.name}>
                        {m.new_field_title()}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        aria-invalid={errors.length > 0}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      />
                      <FieldError
                        errors={errors.map((message) => ({ message }))}
                      />
                    </Field>
                  )
                }}
              </form.Field>

              <form.Field
                name="destination"
                validators={{
                  onChange: ({ value }) =>
                    value.trim()
                      ? undefined
                      : m.editor_destination_required(),
                }}
              >
                {(field) => {
                  const errors = field.state.meta.errors.filter(
                    (error: unknown): error is string =>
                      typeof error === 'string' && error.length > 0,
                  )
                  return (
                    <Field data-invalid={errors.length > 0 || undefined}>
                      <FieldLabel htmlFor={field.name}>
                        {m.new_field_destination()}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        aria-invalid={errors.length > 0}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      />
                      <FieldError
                        errors={errors.map((message) => ({ message }))}
                      />
                    </Field>
                  )
                }}
              </form.Field>

              <form.Subscribe
                selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
                }
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit || isSubmitting || createMutation.isPending
                    }
                  >
                    {m.new_submit()}
                  </Button>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
