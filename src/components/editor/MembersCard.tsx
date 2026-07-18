import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CopyIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '#/components/editor/ConfirmDialog'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { membersQueryOptions, myItineraryQueryOptions } from '#/lib/queries'
import { m } from '#/paraglide/messages'
import {
  regenerateInviteToken,
  removeMember,
  revokeInviteToken,
} from '#/server/members'

/**
 * Invite link + member list for a PRIVATE itinerary — the editor route only
 * renders this when `visibility === 'private'` (see the design doc's
 * Permissions section: token operations and member management are
 * author-only, private itineraries only).
 */
export function MembersCard({
  itineraryId,
  slug,
  inviteToken,
}: {
  itineraryId: string
  slug: string
  inviteToken: string | null
}) {
  const queryClient = useQueryClient()

  const membersQuery = useQuery(membersQueryOptions({ id: itineraryId }))

  function invalidateItinerary() {
    return queryClient.invalidateQueries({
      queryKey: myItineraryQueryOptions({ id: itineraryId }).queryKey,
    })
  }

  function invalidateMembers() {
    return queryClient.invalidateQueries({
      queryKey: membersQueryOptions({ id: itineraryId }).queryKey,
    })
  }

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateInviteToken({ data: { id: itineraryId } }),
    onSuccess: () => void invalidateItinerary(),
    onError: () => toast.error(m.members_invite_regenerate_error()),
  })

  const revokeMutation = useMutation({
    mutationFn: () => revokeInviteToken({ data: { id: itineraryId } }),
    onSuccess: () => void invalidateItinerary(),
    onError: () => toast.error(m.members_invite_revoke_error()),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      removeMember({ data: { id: itineraryId, userId } }),
    onSuccess: () => void invalidateMembers(),
    onError: () => toast.error(m.members_remove_error()),
  })

  const invitePath = inviteToken
    ? `/itineraries/${slug}?invite=${encodeURIComponent(inviteToken)}`
    : null

  async function copyInviteLink() {
    if (!invitePath) return
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${invitePath}`
        : invitePath
    // navigator.clipboard is undefined outside secure contexts
    // (https/localhost), which makes writeText throw — degrade to an
    // error toast instead of an unhandled rejection.
    try {
      await navigator.clipboard.writeText(url)
      toast.success(m.members_invite_copied())
    } catch {
      toast.error(m.members_invite_copy_failed())
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.members_title()}</CardTitle>
        <CardDescription>{m.members_description()}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="invite-link">
            {m.members_invite_link()}
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              id="invite-link"
              readOnly
              value={invitePath ?? m.members_invite_none()}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!invitePath}
              aria-label={m.members_invite_copy()}
              onClick={() => void copyInviteLink()}
            >
              <CopyIcon />
            </Button>
          </div>
        </Field>

        <div className="flex flex-wrap gap-2">
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline" size="sm">
                {m.members_invite_regenerate()}
              </Button>
            }
            title={m.members_invite_regenerate_confirm_title()}
            description={m.members_invite_regenerate_confirm_description()}
            variant="default"
            onConfirm={() => regenerateMutation.mutateAsync()}
          />
          {inviteToken ? (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="outline" size="sm">
                  {m.members_invite_revoke()}
                </Button>
              }
              title={m.members_invite_revoke_confirm_title()}
              description={m.members_invite_revoke_confirm_description()}
              onConfirm={() => revokeMutation.mutateAsync()}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{m.members_list_title()}</h3>
          {membersQuery.data && membersQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {m.members_list_empty()}
            </p>
          ) : null}
          {membersQuery.data?.map(({ member }) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <span className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarImage src={member.image ?? undefined} alt="" />
                  <AvatarFallback>
                    {member.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{member.name}</span>
              </span>
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={m.members_remove({ name: member.name })}
                  >
                    <Trash2Icon />
                  </Button>
                }
                title={m.members_remove_confirm_title({ name: member.name })}
                description={m.members_remove_confirm_description()}
                onConfirm={() => removeMemberMutation.mutateAsync(member.id)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
