import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageUpIcon, PencilIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { maybeDownscaleCoverImage } from '#/lib/image-downscale'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { updateItinerary } from '#/server/itineraries'
import type { EditorItinerary } from '#/server/itineraries'
import {
  ERR_BLOB_STORAGE_NOT_CONFIGURED,
  ERR_FILE_TOO_LARGE,
  MAX_COVER_BYTES,
  uploadCover,
} from '#/server/uploads'

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
    mutationFn: async (file: File) => {
      // Downscale oversized/huge-dimension photos client-side so they fit
      // under Vercel's ~4.5 MB serverless request-body limit — see
      // `maybeDownscaleCoverImage`'s doc comment. Files already small pass
      // through untouched. If the result is still too large (downscale
      // failed on an odd format and the original itself is huge), fail
      // fast with the same sentinel the server would use instead of
      // sending a request that's guaranteed to be rejected with a platform
      // 413 before it even reaches our own size check.
      const uploadable = await maybeDownscaleCoverImage(file)
      if (uploadable.size > MAX_COVER_BYTES) {
        throw new Error(ERR_FILE_TOO_LARGE)
      }

      const formData = new FormData()
      formData.set('itineraryId', itinerary.id)
      formData.set('file', uploadable)
      return uploadCover({ data: formData })
    },
    onSuccess: () => void invalidate(),
    onError: (error) => {
      if (error instanceof Error && error.message === ERR_FILE_TOO_LARGE) {
        toast.error(m.editor_cover_error_too_large())
        return
      }
      if (error instanceof Error && error.message === ERR_BLOB_STORAGE_NOT_CONFIGURED) {
        toast.error(m.editor_cover_error_storage_not_configured())
        return
      }
      toast.error(m.editor_cover_error())
    },
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
    <section className="flex flex-col gap-3">
      <h2 className="text-headline font-semibold text-ink">
        {m.editor_metadata_title()}
      </h2>
      <Card>
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
                {/*
                  Full-width dropzone-style block: the current cover fills
                  it edge to edge (or a dashed placeholder invites a first
                  upload), a `<label>` around the whole thing makes the
                  entire block — not just a tiny file-input control — the
                  click target, and the real `<input type="file">` stays
                  functionally identical (same accept list, same disabled
                  state, same onChange), just visually hidden.
                */}
                <label
                  htmlFor="editor-cover"
                  className={cn(
                    'group relative flex aspect-[21/9] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg',
                    coverMutation.isPending && 'pointer-events-none opacity-70',
                    itinerary.coverImageUrl
                      ? 'bg-surface-sunken'
                      : 'border border-dashed border-line-strong bg-surface-sunken hover:border-terracotta',
                  )}
                >
                  {itinerary.coverImageUrl ? (
                    <>
                      <img
                        src={itinerary.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                      />
                      <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-ink/55 px-3 py-1.5 text-label text-paper opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                        <PencilIcon className="size-3.5" aria-hidden="true" />
                        {m.editor_field_cover()}
                      </span>
                    </>
                  ) : (
                    <span className="flex flex-col items-center gap-2 px-4 text-center text-ink-soft">
                      <ImageUpIcon className="size-6" aria-hidden="true" />
                      <span className="text-label">
                        {m.editor_cover_hint()}
                      </span>
                    </span>
                  )}
                  {coverMutation.isPending ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/45 text-label text-paper">
                      {m.editor_cover_uploading()}
                    </span>
                  ) : null}
                  <input
                    id="editor-cover"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={coverMutation.isPending}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        coverMutation.mutate(file)
                      }
                      event.target.value = ''
                    }}
                  />
                </label>
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
                selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
                }
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
    </section>
  )
}
