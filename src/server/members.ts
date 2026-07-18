/**
 * Member and invite-link server functions for private itineraries.
 *
 * Follows the same `*Impl(db, session, input)` / thin `createServerFn`
 * wrapper pattern and three-sentinel error convention documented in
 * `./errors`.
 *
 * Access rules (design doc's "Permissions" section — invite link / member
 * management is author-only, private itineraries only):
 *   - regenerateInviteToken / revokeInviteToken: author only. Calling these
 *     on a PUBLIC itinerary is FORBIDDEN, not a no-op — the itinerary is
 *     readable (the caller already knows it exists) but token operations
 *     don't apply to it. `requireItineraryAuthor` already collapses "doesn't
 *     exist" and "exists but you're not the author" into NOT_FOUND /
 *     FORBIDDEN respectively (mutation-path convention).
 *   - joinByInviteToken: the token must match a PRIVATE itinerary's stored
 *     non-null token AND the itinerary must be PUBLISHED — a matching token
 *     on an unpublished draft does not grant access (mirrors the
 *     getItineraryBySlugImpl invite-token condition; drafts stay
 *     author-only regardless of token state). Any mismatch (unknown slug,
 *     wrong/missing/revoked token, public itinerary, draft) collapses to
 *     NOT_FOUND so existence is never leaked. The insert is idempotent
 *     (`onConflictDoNothing`, same pattern as `toggleFavoriteImpl`), so
 *     repeat joins always succeed rather than erroring. The author
 *     "joining" their own itinerary is a separate no-op short-circuit —
 *     no row is ever inserted for the author, since they are the owner,
 *     not a member.
 *   - listMembers / removeMember: author only. Removing a userId that isn't
 *     currently a member is NOT_FOUND (the member row doesn't exist).
 */
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { db as appDb } from '#/db'
import type * as schema from '#/db/schema'
import { itinerary, itineraryMember, user } from '#/db/schema'
import { getSessionOrThrow } from './context'
import type { SessionUser } from './itineraries'
import { ERR_FORBIDDEN, ERR_NOT_FOUND, ERR_UNAUTHORIZED } from './errors'
import { requireItineraryAuthor } from './shared'

type Database = NodePgDatabase<typeof schema>

const INVITE_TOKEN_LENGTH = 24

export interface MemberView {
  member: { id: string; name: string; image: string | null }
  createdAt: Date
}

/**
 * Loads an itinerary and asserts the session user is its author AND the
 * itinerary is private. Token operations only apply to private itineraries;
 * a public one is readable (so existence isn't at stake) but the wrong
 * state, hence FORBIDDEN rather than NOT_FOUND.
 */
async function requirePrivateItineraryAuthor(
  db: Database,
  session: SessionUser | null,
  itineraryId: string,
) {
  const row = await requireItineraryAuthor(db, session, itineraryId)
  if (row.visibility !== 'private') {
    throw new Error(ERR_FORBIDDEN)
  }
  return row
}

// ---------------------------------------------------------------------------
// regenerateInviteToken
// ---------------------------------------------------------------------------

const regenerateInviteTokenSchema = z.object({ id: z.string().min(1) })

export type RegenerateInviteTokenInput = z.infer<
  typeof regenerateInviteTokenSchema
>

/** Issues a fresh invite token, replacing (and revoking) any previous one. Author only, private itineraries only. */
export async function regenerateInviteTokenImpl(
  db: Database,
  session: SessionUser | null,
  input: RegenerateInviteTokenInput,
): Promise<{ inviteToken: string }> {
  await requirePrivateItineraryAuthor(db, session, input.id)

  const inviteToken = nanoid(INVITE_TOKEN_LENGTH)
  await db
    .update(itinerary)
    .set({ inviteToken })
    .where(eq(itinerary.id, input.id))

  return { inviteToken }
}

export const regenerateInviteToken = createServerFn({ method: 'POST' })
  .validator(regenerateInviteTokenSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return regenerateInviteTokenImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// revokeInviteToken
// ---------------------------------------------------------------------------

const revokeInviteTokenSchema = z.object({ id: z.string().min(1) })

export type RevokeInviteTokenInput = z.infer<typeof revokeInviteTokenSchema>

/** Clears the invite token, immediately invalidating it for any new joiners. Author only, private itineraries only. */
export async function revokeInviteTokenImpl(
  db: Database,
  session: SessionUser | null,
  input: RevokeInviteTokenInput,
): Promise<void> {
  await requirePrivateItineraryAuthor(db, session, input.id)
  await db
    .update(itinerary)
    .set({ inviteToken: null })
    .where(eq(itinerary.id, input.id))
}

export const revokeInviteToken = createServerFn({ method: 'POST' })
  .validator(revokeInviteTokenSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return revokeInviteTokenImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// joinByInviteToken
// ---------------------------------------------------------------------------

const joinByInviteTokenSchema = z.object({
  slug: z.string().min(1),
  token: z.string().min(1),
})

export type JoinByInviteTokenInput = z.infer<typeof joinByInviteTokenSchema>

/**
 * Joins the caller as a member of the private itinerary identified by
 * `slug`, provided `token` matches its current, non-revoked invite token
 * AND the itinerary is published. Idempotent — repeat joins succeed
 * without error. If the caller is the itinerary's author, this is a
 * no-op success: no `itinerary_member` row is ever inserted for them.
 */
export async function joinByInviteTokenImpl(
  db: Database,
  session: SessionUser | null,
  input: JoinByInviteTokenInput,
): Promise<{ slug: string }> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }

  const row = await db.query.itinerary.findFirst({
    where: eq(itinerary.slug, input.slug),
  })
  if (
    !row ||
    row.visibility !== 'private' ||
    row.status !== 'published' ||
    !row.inviteToken ||
    row.inviteToken !== input.token
  ) {
    throw new Error(ERR_NOT_FOUND)
  }

  // The author "joining" their own itinerary is a no-op success — they're
  // not a member, they're the author, and listMembersImpl must never show
  // them alongside real members.
  if (session.user.id === row.authorId) {
    return { slug: row.slug }
  }

  await db
    .insert(itineraryMember)
    .values({ itineraryId: row.id, userId: session.user.id })
    .onConflictDoNothing()

  return { slug: row.slug }
}

export const joinByInviteToken = createServerFn({ method: 'POST' })
  .validator(joinByInviteTokenSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return joinByInviteTokenImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// listMembers
// ---------------------------------------------------------------------------

const listMembersSchema = z.object({ id: z.string().min(1) })

export type ListMembersInput = z.infer<typeof listMembersSchema>

/** Lists an itinerary's members, newest first. Author only. */
export async function listMembersImpl(
  db: Database,
  session: SessionUser | null,
  input: ListMembersInput,
): Promise<MemberView[]> {
  await requireItineraryAuthor(db, session, input.id)

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      createdAt: itineraryMember.createdAt,
    })
    .from(itineraryMember)
    .innerJoin(user, eq(itineraryMember.userId, user.id))
    .where(eq(itineraryMember.itineraryId, input.id))
    .orderBy(desc(itineraryMember.createdAt))

  return rows.map((row) => ({
    member: { id: row.id, name: row.name, image: row.image },
    createdAt: row.createdAt,
  }))
}

export const listMembers = createServerFn({ method: 'GET' })
  .validator(listMembersSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return listMembersImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// removeMember
// ---------------------------------------------------------------------------

const removeMemberSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
})

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>

/** Removes a member, revoking their access. Author only; a non-member userId is NOT_FOUND. */
export async function removeMemberImpl(
  db: Database,
  session: SessionUser | null,
  input: RemoveMemberInput,
): Promise<void> {
  await requireItineraryAuthor(db, session, input.id)

  const existing = await db.query.itineraryMember.findFirst({
    where: and(
      eq(itineraryMember.itineraryId, input.id),
      eq(itineraryMember.userId, input.userId),
    ),
  })
  if (!existing) {
    throw new Error(ERR_NOT_FOUND)
  }

  await db
    .delete(itineraryMember)
    .where(
      and(
        eq(itineraryMember.itineraryId, input.id),
        eq(itineraryMember.userId, input.userId),
      ),
    )
}

export const removeMember = createServerFn({ method: 'POST' })
  .validator(removeMemberSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return removeMemberImpl(appDb, session, data)
  })
