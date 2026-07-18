import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Field, FieldLabel } from '#/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { m } from '#/paraglide/messages'
import {
  publishItinerary,
  unpublishItinerary,
  updateItinerary,
} from '#/server/itineraries'

type Status = 'draft' | 'published'
type Visibility = 'public' | 'private'

/**
 * Publish status + visibility controls. Every mutation invalidates broadly
 * (any cached query keyed under `'itineraries'`) rather than just this
 * itinerary's editor entry — publishing changes what shows up in discovery
 * search and the `/my` lists too, and there's no cheap way to know which
 * specific cached queries those are from here.
 */
export function PublishCard({
  itineraryId,
  status,
  visibility,
}: {
  itineraryId: string
  status: Status
  visibility: Visibility
}) {
  const queryClient = useQueryClient()

  function invalidateAll() {
    return queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'itineraries',
    })
  }

  const publishMutation = useMutation({
    mutationFn: () => publishItinerary({ data: { id: itineraryId } }),
    onSuccess: () => void invalidateAll(),
    onError: () => toast.error(m.publish_error()),
  })

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishItinerary({ data: { id: itineraryId } }),
    onSuccess: () => void invalidateAll(),
    onError: () => toast.error(m.publish_error()),
  })

  const visibilityMutation = useMutation({
    mutationFn: (nextVisibility: Visibility) =>
      updateItinerary({
        data: { id: itineraryId, visibility: nextVisibility },
      }),
    onSuccess: () => void invalidateAll(),
    onError: () => toast.error(m.publish_visibility_error()),
  })

  const isPending =
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    visibilityMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-headline">{m.publish_title()}</CardTitle>
        <CardDescription className="text-body">
          {status === 'published'
            ? m.publish_status_description_published()
            : m.publish_status_description_draft()}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={status === 'published' ? 'default' : 'secondary'}>
            {status === 'published'
              ? m.publish_status_published()
              : m.publish_status_draft()}
          </Badge>
        </div>

        <Field className="max-w-56">
          <FieldLabel htmlFor="publish-visibility">
            {m.publish_field_visibility()}
          </FieldLabel>
          <Select
            value={visibility}
            disabled={isPending}
            onValueChange={(value) =>
              visibilityMutation.mutate(value as Visibility)
            }
          >
            <SelectTrigger id="publish-visibility" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">
                {m.publish_visibility_public()}
              </SelectItem>
              <SelectItem value="private">
                {m.publish_visibility_private()}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>

      <CardFooter>
        {status === 'published' ? (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => unpublishMutation.mutate()}
          >
            {m.publish_action_unpublish()}
          </Button>
        ) : (
          <Button disabled={isPending} onClick={() => publishMutation.mutate()}>
            {m.publish_action_publish()}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
