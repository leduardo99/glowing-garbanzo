import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Loader2, Minus, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
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
import { Switch } from '#/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { useMutationErrorHandler } from '#/lib/mutation-errors'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { AI_DAILY_GENERATION_LIMIT, generateItineraryDraft, getAiAvailability } from '#/server/ai'
import { AI_STYLE_OPTIONS } from '#/server/domain/ai-draft'
import type { AiStyle } from '#/server/domain/ai-draft'
import { ERR_AI_QUOTA_EXCEEDED } from '#/server/errors'
import { createItinerary } from '#/server/itineraries'
import type { CreateItineraryInput } from '#/server/itineraries'

export const Route = createFileRoute('/new')({
  beforeLoad: ({ context, location }) => {
    if (!context.session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  loader: () => getAiAvailability(),
  component: NewItineraryPage,
})

const STYLE_LABELS: Record<AiStyle, () => string> = {
  adventure: m.ai_style_adventure,
  food: m.ai_style_food,
  family: m.ai_style_family,
  budget: m.ai_style_budget,
  romantic: m.ai_style_romantic,
  culture: m.ai_style_culture,
}

function NewItineraryPage() {
  const ai = Route.useLoaderData()
  const [mode, setMode] = useState<'scratch' | 'ai'>('scratch')

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-sm flex-col justify-center gap-4 p-4 sm:p-8">
      {ai.enabled ? (
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as 'scratch' | 'ai')}
        >
          <TabsList className="w-full *:flex-1">
            <TabsTrigger value="scratch">{m.new_mode_scratch()}</TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles aria-hidden="true" className="size-3.5" />
              {m.new_mode_ai()}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {mode === 'ai' && ai.enabled ? (
        <AiGenerateCard remainingToday={ai.remainingToday} />
      ) : (
        <ScratchCard />
      )}
    </div>
  )
}

function ScratchCard() {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-headline">{m.new_title()}</CardTitle>
        <CardDescription className="text-body">
          {m.new_description()}
        </CardDescription>
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
  )
}

const MIN_DAYS = 1
const MAX_DAYS = 14

function AiGenerateCard({ remainingToday }: { remainingToday: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const handleMutationError = useMutationErrorHandler('/new')

  const [destination, setDestination] = useState('')
  const [destinationTouched, setDestinationTouched] = useState(false)
  const [days, setDays] = useState(5)
  const [styles, setStyles] = useState<AiStyle[]>([])
  const [preferences, setPreferences] = useState('')
  const [geocode, setGeocode] = useState(false)

  const generateMutation = useMutation({
    mutationFn: () =>
      generateItineraryDraft({
        data: {
          destination: destination.trim(),
          days,
          styles,
          preferences: preferences.trim() || undefined,
          geocode,
        },
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'itineraries',
      })
      void navigate({ to: '/my/$id/edit', params: { id: result.id } })
    },
    onError: (error) =>
      handleMutationError(error, () => {
        if (error instanceof Error && error.message === ERR_AI_QUOTA_EXCEEDED) {
          toast.error(m.ai_error_quota())
          return
        }
        toast.error(m.ai_error_failed())
      }),
  })

  const destinationMissing = !destination.trim()
  const destinationError = destinationTouched && destinationMissing
  const quotaExhausted = remainingToday <= 0
  const pending = generateMutation.isPending

  function toggleStyle(style: AiStyle) {
    setStyles((current) =>
      current.includes(style)
        ? current.filter((s) => s !== style)
        : [...current, style],
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-headline">{m.new_mode_ai()}</CardTitle>
        <CardDescription className="text-body">
          {m.ai_description()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setDestinationTouched(true)
            if (destinationMissing || quotaExhausted || pending) {
              return
            }
            generateMutation.mutate()
          }}
        >
          <FieldGroup>
            <Field data-invalid={destinationError || undefined}>
              <FieldLabel htmlFor="ai-destination">
                {m.new_field_destination()}
              </FieldLabel>
              <Input
                id="ai-destination"
                name="destination"
                value={destination}
                aria-invalid={destinationError}
                disabled={pending}
                onBlur={() => setDestinationTouched(true)}
                onChange={(event) => setDestination(event.target.value)}
              />
              <FieldError
                errors={
                  destinationError
                    ? [{ message: m.editor_destination_required() }]
                    : []
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="ai-days">{m.ai_field_days()}</FieldLabel>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={m.ai_days_decrease()}
                  disabled={pending || days <= MIN_DAYS}
                  onClick={() => setDays((d) => Math.max(MIN_DAYS, d - 1))}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <output
                  id="ai-days"
                  aria-live="polite"
                  className="min-w-10 text-center text-title tabular-nums"
                >
                  {days}
                </output>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={m.ai_days_increase()}
                  disabled={pending || days >= MAX_DAYS}
                  onClick={() => setDays((d) => Math.min(MAX_DAYS, d + 1))}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            </Field>

            <Field>
              <FieldLabel>{m.ai_field_styles()}</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {AI_STYLE_OPTIONS.map((style) => {
                  const selected = styles.includes(style)
                  return (
                    <button
                      key={style}
                      type="button"
                      disabled={pending}
                      aria-pressed={selected}
                      onClick={() => toggleStyle(style)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-colors',
                        selected
                          ? 'border-transparent bg-primary text-primary-foreground'
                          : 'border-input bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {STYLE_LABELS[style]()}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="ai-preferences">
                {m.ai_field_preferences()}
              </FieldLabel>
              <Textarea
                id="ai-preferences"
                name="preferences"
                rows={3}
                value={preferences}
                placeholder={m.ai_preferences_placeholder()}
                disabled={pending}
                onChange={(event) => setPreferences(event.target.value)}
              />
            </Field>

            <Field orientation="horizontal">
              <Switch
                id="ai-geocode"
                checked={geocode}
                disabled={pending}
                onCheckedChange={setGeocode}
              />
              <div className="flex flex-col gap-0.5">
                <FieldLabel htmlFor="ai-geocode">
                  {m.ai_field_geocode()}
                </FieldLabel>
                <p className="text-caption text-muted-foreground">
                  {m.ai_geocode_hint()}
                </p>
              </div>
            </Field>

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                disabled={pending || quotaExhausted || destinationMissing}
              >
                {pending ? (
                  <>
                    <Loader2 aria-hidden="true" className="animate-spin" />
                    {m.ai_generating()}
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden="true" />
                    {m.ai_generate()}
                  </>
                )}
              </Button>
              <p
                className="text-center text-caption text-muted-foreground"
                aria-live="polite"
              >
                {quotaExhausted
                  ? m.ai_error_quota()
                  : m.ai_remaining({
                      count: remainingToday,
                      limit: AI_DAILY_GENERATION_LIMIT,
                    })}
              </p>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
