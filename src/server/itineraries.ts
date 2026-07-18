/**
 * Itinerary CRUD, publish/unpublish, search, get, and fork.
 *
 * Testability pattern: every operation is a plain `*Impl(db, session, input)`
 * function containing all the logic (queries, access checks, mutations).
 * The exported `createServerFn` below it is a thin wrapper that resolves the
 * request/session and Zod-validates input, then delegates to the Impl.
 * Integration tests call the Impl functions directly against `testDb` with
 * fake sessions (`{ user: { id } }` or `null`) — no HTTP involved.
 *
 * Error-handling convention (all Impl functions, here and in days-stops.ts /
 * engagement.ts too): see `./errors` for the three sentinel strings
 * (UNAUTHORIZED / FORBIDDEN / NOT_FOUND) and the throw convention.
 */
import { z } from 'zod'
import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { db as appDb } from '#/db'
import type * as schema from '#/db/schema'
import {
  favorite,
  itinerary,
  itineraryDay,
  rating,
  stop,
  user,
} from '#/db/schema'
import { getOptionalSession, getSessionOrThrow } from './context'
import type { AccessContext, ItineraryAccessData } from './domain/access'
import { canEdit, canRead } from './domain/access'
import { buildForkRows } from './domain/fork'
import type { StopCopy } from './domain/fork'
import { makeSlug } from './domain/slug'
import { ERR_NOT_FOUND, ERR_UNAUTHORIZED } from './errors'
import {
  isItineraryMember,
  loadItineraryOrThrow,
  requireItineraryAuthor,
} from './shared'

type Database = NodePgDatabase<typeof schema>

/** Minimal session shape the Impl functions need — a superset of Better Auth's session. */
export interface SessionUser {
  user: { id: string }
}

/** Page size for `searchItineraries` — exported so the discovery route can compute pagination. */
export const PAGE_SIZE = 12

export interface ItineraryCard {
  id: string
  slug: string
  title: string
  destination: string | null
  summary: string | null
  tags: string[]
  coverImageUrl: string | null
  ratingAvg: number | null
  ratingCount: number
  dayCount: number
  publishedAt: Date | null
}

export interface StopView {
  id: string
  position: number
  name: string
  category: 'attraction' | 'food' | 'lodging' | 'transport' | 'other'
  description: string | null
  costCents: number | null
  lat: number | null
  lng: number | null
  placeLabel: string | null
}

export interface DayView {
  id: string
  dayNumber: number
  title: string | null
  note: string | null
  stops: StopView[]
}

export interface AuthorView {
  id: string
  name: string
  image: string | null
}

export interface ForkedFromView {
  slug: string
  title: string
}

export interface ItineraryDetail {
  id: string
  slug: string
  title: string
  summary: string | null
  destination: string | null
  tags: string[]
  coverImageUrl: string | null
  status: 'draft' | 'published'
  visibility: 'public' | 'private'
  authorId: string
  author: AuthorView
  forkedFromId: string | null
  /** Source itinerary's slug + title, for the "forked from" credit link. `null` when not a fork. */
  forkedFrom: ForkedFromView | null
  ratingAvg: number | null
  ratingCount: number
  publishedAt: Date | null
  createdAt: Date
  days: DayView[]
  viewer: {
    canEdit: boolean
    isFavorite: boolean
    myStars: number | null
    isMember: boolean
  }
}

async function loadDaysWithStops(
  db: Database,
  itineraryId: string,
): Promise<DayView[]> {
  const days = await db.query.itineraryDay.findMany({
    where: eq(itineraryDay.itineraryId, itineraryId),
    orderBy: asc(itineraryDay.dayNumber),
  })
  const dayIds = days.map((d) => d.id)
  const stops = dayIds.length
    ? await db.query.stop.findMany({
        where: inArray(stop.dayId, dayIds),
        orderBy: asc(stop.position),
      })
    : []

  const stopsByDay = new Map<string, StopView[]>()
  for (const s of stops) {
    const list = stopsByDay.get(s.dayId) ?? []
    list.push(s)
    stopsByDay.set(s.dayId, list)
  }

  return days.map((d) => ({
    id: d.id,
    dayNumber: d.dayNumber,
    title: d.title,
    note: d.note,
    stops: stopsByDay.get(d.id) ?? [],
  }))
}

// ---------------------------------------------------------------------------
// searchItineraries
// ---------------------------------------------------------------------------

const searchItinerariesSchema = z.object({
  q: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minDays: z.number().int().positive().optional(),
  maxDays: z.number().int().positive().optional(),
  sort: z.enum(['recent', 'top']),
  page: z.number().int().min(1),
})

export type SearchItinerariesInput = z.infer<typeof searchItinerariesSchema>

/** Public discovery search: published + public itineraries only. */
export async function searchItinerariesImpl(
  db: Database,
  input: SearchItinerariesInput,
): Promise<{ items: ItineraryCard[]; total: number }> {
  // NOTE: `${itinerary.id}` renders as a bare, unqualified `"id"` when
  // embedded in a `sql` template (drizzle only qualifies columns it knows
  // are ambiguous within the *outer* select, not inside a nested subquery
  // it can't see into) — which here would collide with itinerary_day's own
  // `id` column inside the subquery's FROM. Force explicit qualification.
  const dayCountExpr = sql<number>`(select count(*)::int from ${itineraryDay} where ${itineraryDay.itineraryId} = ${sql.raw('"itinerary"."id"')})`

  const conditions = [
    eq(itinerary.status, 'published'),
    eq(itinerary.visibility, 'public'),
  ]

  if (input.q) {
    const pattern = `%${input.q}%`
    conditions.push(
      or(
        ilike(itinerary.title, pattern),
        ilike(itinerary.destination, pattern),
        ilike(itinerary.summary, pattern),
      )!,
    )
  }

  if (input.tags && input.tags.length > 0) {
    conditions.push(arrayOverlaps(itinerary.tags, input.tags))
  }

  if (input.minDays !== undefined) {
    conditions.push(gte(dayCountExpr, input.minDays))
  }
  if (input.maxDays !== undefined) {
    conditions.push(lte(dayCountExpr, input.maxDays))
  }

  const whereClause = and(...conditions)!

  const orderBy =
    input.sort === 'top'
      ? [
          sql`${itinerary.ratingAvg} DESC NULLS LAST`,
          desc(itinerary.ratingCount),
        ]
      : [desc(itinerary.publishedAt)]

  const offset = (input.page - 1) * PAGE_SIZE

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: itinerary.id,
        slug: itinerary.slug,
        title: itinerary.title,
        destination: itinerary.destination,
        summary: itinerary.summary,
        tags: itinerary.tags,
        coverImageUrl: itinerary.coverImageUrl,
        ratingAvg: itinerary.ratingAvg,
        ratingCount: itinerary.ratingCount,
        publishedAt: itinerary.publishedAt,
        dayCount: dayCountExpr,
      })
      .from(itinerary)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(itinerary)
      .where(whereClause),
  ])

  const items: ItineraryCard[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    destination: row.destination,
    summary: row.summary,
    tags: row.tags ?? [],
    coverImageUrl: row.coverImageUrl,
    ratingAvg: row.ratingAvg === null ? null : parseFloat(row.ratingAvg),
    ratingCount: row.ratingCount,
    dayCount: row.dayCount,
    publishedAt: row.publishedAt,
  }))

  return { items, total: totalRows[0]?.count ?? 0 }
}

export const searchItineraries = createServerFn({ method: 'GET' })
  .validator(searchItinerariesSchema)
  .handler(async ({ data }) => searchItinerariesImpl(appDb, data))

// ---------------------------------------------------------------------------
// getItineraryBySlug
// ---------------------------------------------------------------------------

const getItineraryBySlugSchema = z.object({
  slug: z.string().min(1),
  inviteToken: z.string().optional(),
})

export type GetItineraryBySlugInput = z.infer<typeof getItineraryBySlugSchema>

/**
 * Full itinerary detail (days + stops) plus viewer flags. Throws NOT_FOUND
 * for an unknown slug or when the caller has no read access — the two are
 * indistinguishable by design.
 */
export async function getItineraryBySlugImpl(
  db: Database,
  session: SessionUser | null,
  input: GetItineraryBySlugInput,
): Promise<ItineraryDetail> {
  const row = await db.query.itinerary.findFirst({
    where: eq(itinerary.slug, input.slug),
  })
  if (!row) {
    throw new Error(ERR_NOT_FOUND)
  }

  const userId = session?.user.id ?? null
  const isMember = userId
    ? await isItineraryMember(db, { itineraryId: row.id, userId })
    : false

  const accessData: ItineraryAccessData = {
    authorId: row.authorId,
    status: row.status,
    visibility: row.visibility,
  }
  const accessCtx: AccessContext = { userId, isMember }

  let hasAccess = canRead(accessData, accessCtx)
  if (
    !hasAccess &&
    input.inviteToken &&
    row.visibility === 'private' &&
    row.status === 'published' &&
    row.inviteToken &&
    row.inviteToken === input.inviteToken
  ) {
    hasAccess = true
  }
  if (!hasAccess) {
    throw new Error(ERR_NOT_FOUND)
  }

  const [days, authorRow, forkedFromRow] = await Promise.all([
    loadDaysWithStops(db, row.id),
    db.query.user.findFirst({
      where: eq(user.id, row.authorId),
      columns: { id: true, name: true, image: true },
    }),
    row.forkedFromId
      ? db.query.itinerary.findFirst({
          where: eq(itinerary.id, row.forkedFromId),
          columns: { slug: true, title: true },
        })
      : Promise.resolve(null),
  ])
  // authorId is a not-null FK to `user`, so authorRow is always present in
  // practice; the fallback only guards against a pathological missing row
  // rather than encoding a real product state.
  const author: AuthorView = authorRow ?? {
    id: row.authorId,
    name: row.authorId,
    image: null,
  }
  const forkedFrom: ForkedFromView | null = forkedFromRow ?? null

  let isFavorite = false
  let myStars: number | null = null
  if (userId) {
    const [favoriteRow, ratingRow] = await Promise.all([
      db.query.favorite.findFirst({
        where: and(
          eq(favorite.userId, userId),
          eq(favorite.itineraryId, row.id),
        ),
      }),
      db.query.rating.findFirst({
        where: and(eq(rating.userId, userId), eq(rating.itineraryId, row.id)),
      }),
    ])
    isFavorite = Boolean(favoriteRow)
    myStars = ratingRow ? ratingRow.stars : null
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    destination: row.destination,
    tags: row.tags ?? [],
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    visibility: row.visibility,
    authorId: row.authorId,
    author,
    forkedFromId: row.forkedFromId,
    forkedFrom,
    ratingAvg: row.ratingAvg === null ? null : parseFloat(row.ratingAvg),
    ratingCount: row.ratingCount,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    days,
    viewer: {
      canEdit: canEdit(accessData, accessCtx),
      isFavorite,
      myStars,
      isMember,
    },
  }
}

export const getItineraryBySlug = createServerFn({ method: 'GET' })
  .validator(getItineraryBySlugSchema)
  .handler(async ({ data }) => {
    const session = await getOptionalSession(getRequest())
    return getItineraryBySlugImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// createItinerary
// ---------------------------------------------------------------------------

const createItinerarySchema = z.object({
  title: z.string().min(1),
  destination: z.string().min(1),
})

export type CreateItineraryInput = z.infer<typeof createItinerarySchema>

/** Creates a draft itinerary owned by the caller, with a single empty day. */
export async function createItineraryImpl(
  db: Database,
  session: SessionUser | null,
  input: CreateItineraryInput,
): Promise<{ id: string; slug: string }> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }

  const slug = makeSlug(input.title)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(itinerary)
      .values({
        authorId: session.user.id,
        title: input.title,
        destination: input.destination,
        slug,
      })
      .returning({ id: itinerary.id, slug: itinerary.slug })

    await tx
      .insert(itineraryDay)
      .values({ itineraryId: created.id, dayNumber: 1 })

    return created
  })
}

export const createItinerary = createServerFn({ method: 'POST' })
  .validator(createItinerarySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return createItineraryImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// updateItinerary
// ---------------------------------------------------------------------------

const updateItinerarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  summary: z.string().nullable().optional(),
  destination: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  coverImageUrl: z.string().nullable().optional(),
})

export type UpdateItineraryInput = z.infer<typeof updateItinerarySchema>

/** Updates metadata fields on an itinerary. Author only; slug is immutable. */
export async function updateItineraryImpl(
  db: Database,
  session: SessionUser | null,
  input: UpdateItineraryInput,
): Promise<void> {
  await requireItineraryAuthor(db, session, input.id)

  const updates: Partial<typeof itinerary.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.summary !== undefined) updates.summary = input.summary
  if (input.destination !== undefined) updates.destination = input.destination
  if (input.tags !== undefined) updates.tags = input.tags
  if (input.visibility !== undefined) updates.visibility = input.visibility
  if (input.coverImageUrl !== undefined)
    updates.coverImageUrl = input.coverImageUrl

  if (Object.keys(updates).length === 0) {
    return
  }

  await db.update(itinerary).set(updates).where(eq(itinerary.id, input.id))
}

export const updateItinerary = createServerFn({ method: 'POST' })
  .validator(updateItinerarySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return updateItineraryImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// deleteItinerary
// ---------------------------------------------------------------------------

const deleteItinerarySchema = z.object({ id: z.string().min(1) })

export type DeleteItineraryInput = z.infer<typeof deleteItinerarySchema>

/** Deletes an itinerary. Author only; days/stops cascade via FK. */
export async function deleteItineraryImpl(
  db: Database,
  session: SessionUser | null,
  input: DeleteItineraryInput,
): Promise<void> {
  await requireItineraryAuthor(db, session, input.id)
  await db.delete(itinerary).where(eq(itinerary.id, input.id))
}

export const deleteItinerary = createServerFn({ method: 'POST' })
  .validator(deleteItinerarySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return deleteItineraryImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// publishItinerary / unpublishItinerary
// ---------------------------------------------------------------------------

const publishItinerarySchema = z.object({ id: z.string().min(1) })

export type PublishItineraryInput = z.infer<typeof publishItinerarySchema>

/** Publishes a draft (or re-publishes). Author only. */
export async function publishItineraryImpl(
  db: Database,
  session: SessionUser | null,
  input: PublishItineraryInput,
): Promise<void> {
  await requireItineraryAuthor(db, session, input.id)
  await db
    .update(itinerary)
    .set({ status: 'published', publishedAt: new Date() })
    .where(eq(itinerary.id, input.id))
}

/** Reverts a published itinerary to draft. Author only. */
export async function unpublishItineraryImpl(
  db: Database,
  session: SessionUser | null,
  input: PublishItineraryInput,
): Promise<void> {
  await requireItineraryAuthor(db, session, input.id)
  await db
    .update(itinerary)
    .set({ status: 'draft' })
    .where(eq(itinerary.id, input.id))
}

export const publishItinerary = createServerFn({ method: 'POST' })
  .validator(publishItinerarySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return publishItineraryImpl(appDb, session, data)
  })

export const unpublishItinerary = createServerFn({ method: 'POST' })
  .validator(publishItinerarySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return unpublishItineraryImpl(appDb, session, data)
  })

// ---------------------------------------------------------------------------
// forkItinerary
// ---------------------------------------------------------------------------

const forkItinerarySchema = z.object({ id: z.string().min(1) })

export type ForkItineraryInput = z.infer<typeof forkItinerarySchema>

/**
 * Copies an itinerary (days + stops) into a new draft owned by the caller,
 * crediting the original via `forkedFromId`. Requires a session with read
 * access to the source itinerary.
 */
export async function forkItineraryImpl(
  db: Database,
  session: SessionUser | null,
  input: ForkItineraryInput,
): Promise<{ id: string; slug: string }> {
  if (!session) {
    throw new Error(ERR_UNAUTHORIZED)
  }
  const userId = session.user.id

  const row = await loadItineraryOrThrow(db, input.id)

  const isMember = await isItineraryMember(db, { itineraryId: row.id, userId })
  const accessData: ItineraryAccessData = {
    authorId: row.authorId,
    status: row.status,
    visibility: row.visibility,
  }
  if (!canRead(accessData, { userId, isMember })) {
    throw new Error(ERR_NOT_FOUND)
  }

  const days = await loadDaysWithStops(db, row.id)
  const newSlug = makeSlug(row.title)

  const forkRows = buildForkRows(
    {
      itinerary: {
        title: row.title,
        summary: row.summary,
        destination: row.destination ?? '',
        tags: row.tags ?? [],
        coverImageUrl: row.coverImageUrl,
      },
      days: days.map((d) => ({
        dayNumber: d.dayNumber,
        title: d.title,
        note: d.note,
        stops: d.stops.map((s): StopCopy => ({
          position: s.position,
          name: s.name,
          category: s.category,
          description: s.description,
          costCents: s.costCents,
          lat: s.lat,
          lng: s.lng,
          placeLabel: s.placeLabel,
        })),
      })),
    },
    { newOwnerId: userId, sourceItineraryId: row.id, newSlug },
  )

  return db.transaction(async (tx) => {
    const [newItinerary] = await tx
      .insert(itinerary)
      .values(forkRows.itinerary)
      .returning({ id: itinerary.id, slug: itinerary.slug })

    for (const day of forkRows.days) {
      const [newDay] = await tx
        .insert(itineraryDay)
        .values({
          itineraryId: newItinerary.id,
          dayNumber: day.dayNumber,
          title: day.title,
          note: day.note,
        })
        .returning({ id: itineraryDay.id })

      if (day.stops.length > 0) {
        await tx
          .insert(stop)
          .values(day.stops.map((s) => ({ ...s, dayId: newDay.id })))
      }
    }

    return newItinerary
  })
}

export const forkItinerary = createServerFn({ method: 'POST' })
  .validator(forkItinerarySchema)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    return forkItineraryImpl(appDb, session, data)
  })
