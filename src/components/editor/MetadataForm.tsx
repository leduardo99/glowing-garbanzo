import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { m } from '#/paraglide/messages'
import { updateItinerary } from '#/server/itineraries'
import type { EditorItinerary } from '#/server/itineraries'
import { uploadCover } from '#/server/uploads'

/**
 * Title/summary/destination/tags + cover photo. Tags are a chip input
 * (Enter adds, click × removes) local to this form's state until "Save" is
 * pressed, which sends the whole set together with the text fields in one
 * `updateItinerary` call. Cover upload is separate — it round-trips
 * immediately on file selection (own mutation, own pending state) since
 * there's nothing to batch with the rest of the form.
 */
export function MetadataForm({ itinerary }: { itinerary: EditorItinerary }) {
  const queryClient = useQueryClient()
  const [tags, setTags] = useState<string[]>(itinerary.tags)
  const [tagDraft, setTagDraft] = useState('')

  // Broad invalidation — title/summary/destination/tags/cover all surface
  // in the `/my` list cards and (once published) discovery search, not just
  // this editor's own cache entry. See `PublishCard`'s doc comment.
  function invalidate() {
    return queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'itineraries',
    })
  }

  const saveMutation = useMutation({
    mutationFn: (values: {
      title: string
      summary: string
      destination: string
    }) =>
      updateItinerary({
        data: {
          id: itinerary.id,
          title: values.title,
          summary: values.summary || null,
          destination: values.destination,
          tags,
        },
      }),
    onSuccess: () => {
      void invalidate()
      toast.success(m.editor_save_success())
    },
    onError: () => toast.error(m.editor_save_error()),
  })

  const coverMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.set('itineraryId', itinerary.id)
      formData.set('file', file)
      return uploadCover({ data: formData })
    },
    onSuccess: () => void invalidate(),
    onError: () => toast.error(m.editor_cover_error()),
  })

  const form = useForm({
    defaultValues: {
      title: itinerary.title,
      summary: itinerary.summary ?? '',
      destination: itinerary.destination ?? '',
    },
    onSubmit: async ({ value }) => {
      await saveMutation.mutateAsync(value)
    },
  })

  function addTag() {
    const trimmed = tagDraft.trim()
    setTagDraft('')
    if (!trimmed || tags.includes(trimmed)) return
    setTags((prev) => [...prev, trimmed])
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-headline">
          {m.editor_metadata_title()}
        </CardTitle>
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
            <Field>
              <FieldLabel htmlFor="editor-cover">
                {m.editor_field_cover()}
              </FieldLabel>
              {itinerary.coverImageUrl ? (
                <img
                  src={itinerary.coverImageUrl}
                  alt=""
                  className="h-40 w-full max-w-md rounded-md object-cover"
                />
              ) : null}
              <input
                id="editor-cover"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={coverMutation.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    coverMutation.mutate(file)
                  }
                  event.target.value = ''
                }}
              />
              {coverMutation.isPending ? (
                <p className="text-sm text-muted-foreground">
                  {m.editor_cover_uploading()}
                </p>
              ) : null}
            </Field>

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
                      {m.editor_field_title()}
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
                  value.trim() ? undefined : m.editor_destination_required(),
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
                      {m.editor_field_destination()}
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

            <form.Field name="summary">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {m.editor_field_summary()}
                  </FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.value)
                    }
                  />
                </Field>
              )}
            </form.Field>

            <Field>
              <FieldLabel htmlFor="editor-tags">
                {m.editor_field_tags()}
              </FieldLabel>
              <Input
                id="editor-tags"
                placeholder={m.editor_field_tags_placeholder()}
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addTag()
                  }
                }}
              />
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={m.editor_tag_remove({ tag })}
                        className="cursor-pointer"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Field>

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="self-start"
                  disabled={
                    !canSubmit || isSubmitting || saveMutation.isPending
                  }
                >
                  {m.editor_save()}
                </Button>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
