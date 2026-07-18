/**
 * Favorite, rating, and comment server functions.
 *
 * Follows the same `*Impl(db, session, input)` / thin `createServerFn`
 * wrapper pattern and three-sentinel error convention documented at the top
 * of `itineraries.ts` (UNAUTHORIZED / FORBIDDEN / NOT_FOUND).
 *
 * Access rules (design doc's "Permissions" section):
 *   - favorite / comment: requires a session AND read access to the
 *     itinerary. A private draft belonging to someone else collapses to
 *     NOT_FOUND, same read-leak-proofing as `getItineraryBySlugImpl`.
 *   - rating: requires a session, read access (NOT_FOUND otherwise), AND
 *     the itinerary being published+public (`canRate`). A readable but
 *     not-yet-published (or private) itinerary is FORBIDDEN, not NOT_FOUND
 *     — the caller already knows it exists.
 *   - listing comments mirrors itinerary *view* access: no login required,
 *     just read access (so an anonymous visitor sees comments on a public
 *     itinerary, same as the itinerary page itself).
 *   - deleting a comment: only that comment's own author, never the
 *     itinerary's author (MVP has no moderation).
 */
import { z } from 'zod'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { db as appDb } from '#/db'
import type * as schema from '#/db/schema'
import { comment, favorite, itinerary, itineraryMember, rating, user } from '#/db/schema'
import { getOptionalSession, getSessionOrThrow } from './context'
import type { SessionUser } from './itineraries'
import type { AccessContext, ItineraryAccessData } from './domain/access'
import { canRate, canRead } from './domain/access'
import { applyRating } from './domain/rating'

type Database = NodePgDatabase<typeof schema>

const ERR_UNAUTHORIZED = 'UNAUTHORIZED'
const ERR_FORBIDDEN = 'FORBIDDEN'
const ERR_NOT_FOUND = 'NOT_FOUND'

const COMMENTS_PAGE_SIZE = 20

export interface CommentView {
  id: string
  body: string
  createdAt: Date
  author: { id: string; name: string; image: string | null }
}

// ---------------------------------------------------------------------------
// Shared access helpers
// ---------------------------------------------------------------------------

async function loadItineraryOrThrow(db: Database, id: string) {
  const row = await db.query.itinerary.findFirst({ where: eq(itinerary.id, id) })
  if (!row) {
    throw new Error(ERR_NOT_FOUND)
  }
  return row
}

async function isItineraryMember(db: Database, itineraryId: string, userId: string): Promise<boolean> {
  const membership = await db.query.itineraryMember.findFirst({
    where: and(eq(itineraryMember.itineraryId, itineraryId), eq(itineraryMember.userId, userId)),
  })
  return Boolean(membership)
}

/**
 * Loads an itinerary and asserts read access, collapsing "doesn't exist"
 * and "exists but unreadable" into the same NOT_FOUND. Session is optional
 * — matches itinerary *view* access, open to anonymous visitors for
 * published+public itineraries.
 */
async function loadReadableItinerary(db: Database, session: SessionUser | null, itineraryId: string) {
  const row = await loadItineraryOrThrow(db, itineraryId)
  const userId = session?.user.id ?? null
  const isMember = userId ? await isItineraryMember(db, row.id, userId) : false
  const accessData: ItineraryAccessData = {
    authorId: row.authorId,
    status: row.status,
    visibility: row.visibility,
  }
  if (!canRead(accessData, { userId, isMember })) {
    throw new Error(ERR_NOT_FOUND)
  }
  return row
}

// ---------------------------------------------------------------------------
// toggleFavorite
// ---------------------------------------------------------------------------

const toggleFavoriteSchema = z.object({ itineraryId: z.string().min(1) })

export type ToggleFavoriteInput = z.infer<typeof toggleFavoriteSchema>

/** Toggles the caller's favorite row for an itinerary on/off. Login + read access required. */
export async function toggleFavoriteImpl(
  db: Database,
  session: SessionUser | null,
  input: ToggleFavoriteInput,
): Promise<{ favorite: boolean }> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const userId = session.user.id
  await loadReadableItinerary(db, session, input.itineraryId)

  const existing = await db.query.favorite.findFirst({
    where: and(eq(favorite.userId, userId), eq(favorite.itineraryId, input.itineraryId)),
  })

  if (existing) {
    await db
      .delete(favorite)
      .where(and(eq(favorite.userId, userId), eq(favorite.itineraryId, input.itineraryId)))
    return { favorite: false }
  }

  await db.insert(favorite).values({ userId, itineraryId: input.itineraryId })
  return { favorite: true }
}

export const toggleFavorite = createServerFn({ method: 'POST' })
  .validator(toggleFavoriteSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return toggleFavoriteImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// rateItinerary
// ---------------------------------------------------------------------------

const rateItinerarySchema = z.object({
  id: z.string().min(1),
  stars: z.number().int().min(1).max(5),
})

export type RateItineraryInput = z.infer<typeof rateItinerarySchema>

/**
 * Upserts the caller's rating (one row per user+itinerary) and recalculates
 * `ratingAvg`/`ratingCount` in the same transaction, using `applyRating` for
 * the aggregate math. `FOR UPDATE` on the itinerary row serializes
 * concurrent raters of the same itinerary so the read-modify-write of the
 * aggregate can't race. Requires published+public (`canRate`); a readable
 * itinerary that isn't ratable yet is FORBIDDEN, an unreadable one is
 * NOT_FOUND.
 */
export async function rateItineraryImpl(
  db: Database,
  session: SessionUser | null,
  input: RateItineraryInput,
): Promise<{ ratingAvg: number; ratingCount: number }> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const userId = session.user.id

  return db.transaction(async (tx) => {
    const lockedRows = await tx
      .select()
      .from(itinerary)
      .where(eq(itinerary.id, input.id))
      .for('update')
    if (lockedRows.length === 0) {
      throw new Error(ERR_NOT_FOUND)
    }
    const itineraryRow = lockedRows[0]

    const isMember = await isItineraryMember(tx, itineraryRow.id, userId)
    const accessData: ItineraryAccessData = {
      authorId: itineraryRow.authorId,
      status: itineraryRow.status,
      visibility: itineraryRow.visibility,
    }
    const ctx: AccessContext = { userId, isMember }
    if (!canRead(accessData, ctx)) {
      throw new Error(ERR_NOT_FOUND)
    }
    if (!canRate(accessData, ctx)) {
      throw new Error(ERR_FORBIDDEN)
    }

    const existingRating = await tx.query.rating.findFirst({
      where: and(eq(rating.userId, userId), eq(rating.itineraryId, itineraryRow.id)),
    })
    const previousStars = existingRating ? existingRating.stars : null

    const nextAgg = applyRating(
      {
        ratingAvg: itineraryRow.ratingAvg === null ? null : parseFloat(itineraryRow.ratingAvg),
        ratingCount: itineraryRow.ratingCount,
      },
      previousStars,
      input.stars,
    )

    if (existingRating) {
      await tx
        .update(rating)
        .set({ stars: input.stars })
        .where(and(eq(rating.userId, userId), eq(rating.itineraryId, itineraryRow.id)))
    } else {
      await tx.insert(rating).values({ userId, itineraryId: itineraryRow.id, stars: input.stars })
    }

    await tx
      .update(itinerary)
      .set({ ratingAvg: String(nextAgg.ratingAvg), ratingCount: nextAgg.ratingCount })
      .where(eq(itinerary.id, itineraryRow.id))

    return nextAgg
  })
}

export const rateItinerary = createServerFn({ method: 'POST' })
  .validator(rateItinerarySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return rateItineraryImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// listComments
// ---------------------------------------------------------------------------

const listCommentsSchema = z.object({
  itineraryId: z.string().min(1),
  page: z.number().int().min(1).default(1),
})

export type ListCommentsInput = z.infer<typeof listCommentsSchema>

/** Newest-first, paginated comments with author `{ id, name, image }`. Mirrors itinerary view access. */
export async function listCommentsImpl(
  db: Database,
  session: SessionUser | null,
  input: ListCommentsInput,
): Promise<{ items: CommentView[]; total: number }> {
  await loadReadableItinerary(db, session, input.itineraryId)

  const offset = (input.page - 1) * COMMENTS_PAGE_SIZE

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        authorId: user.id,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(comment)
      .innerJoin(user, eq(comment.authorId, user.id))
      .where(eq(comment.itineraryId, input.itineraryId))
      .orderBy(desc(comment.createdAt))
      .limit(COMMENTS_PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(comment)
      .where(eq(comment.itineraryId, input.itineraryId)),
  ])

  const items: CommentView[] = rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    author: { id: row.authorId, name: row.authorName, image: row.authorImage },
  }))

  return { items, total: totalRows[0]?.count ?? 0 }
}

export const listComments = createServerFn({ method: 'GET' })
  .validator(listCommentsSchema)
  .handler(async ({ data }) => {
    const session = await getOptionalSession(getRequest())
    return listCommentsImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// addComment
// ---------------------------------------------------------------------------

const addCommentSchema = z.object({
  itineraryId: z.string().min(1),
  body: z.string().min(1),
})

export type AddCommentInput = z.infer<typeof addCommentSchema>

/** Adds a comment. Login + read access required. Returns the comment with author fields. */
export async function addCommentImpl(
  db: Database,
  session: SessionUser | null,
  input: AddCommentInput,
): Promise<CommentView> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const userId = session.user.id
  await loadReadableItinerary(db, session, input.itineraryId)

  const [created] = await db
    .insert(comment)
    .values({ itineraryId: input.itineraryId, authorId: userId, body: input.body })
    .returning()

  // `userId` comes from the session that was just re-loaded above, so the
  // author row is guaranteed to exist.
  const authorRow = (await db.query.user.findFirst({ where: eq(user.id, userId) }))!

  return {
    id: created.id,
    body: created.body,
    createdAt: created.createdAt,
    author: { id: authorRow.id, name: authorRow.name, image: authorRow.image },
  }
}

export const addComment = createServerFn({ method: 'POST' })
  .validator(addCommentSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return addCommentImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// deleteComment
// ---------------------------------------------------------------------------

const deleteCommentSchema = z.object({ id: z.string().min(1) })

export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>

/** Deletes a comment. Only the comment's own author — the itinerary author has no override in the MVP. */
export async function deleteCommentImpl(
  db: Database,
  session: SessionUser | null,
  input: DeleteCommentInput,
): Promise<void> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }

  const row = await db.query.comment.findFirst({ where: eq(comment.id, input.id) })
  if (!row) {
    throw new Error(ERR_NOT_FOUND)
  }
  if (row.authorId !== session.user.id) {
    throw new Error(ERR_FORBIDDEN)
  }

  await db.delete(comment).where(eq(comment.id, row.id))
}

export const deleteComment = createServerFn({ method: 'POST' })
  .validator(deleteCommentSchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return deleteCommentImpl(appDb, session, data)
  })
