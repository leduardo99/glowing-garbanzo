import { nanoid } from 'nanoid'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  time,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

import { user } from './auth-schema'

export const itineraryStatus = pgEnum('itinerary_status', ['draft', 'published'])
export const itineraryVisibility = pgEnum('itinerary_visibility', ['public', 'private'])
export const stopCategory = pgEnum('stop_category', [
  'attraction',
  'food',
  'lodging',
  'transport',
  'other',
])

export const itinerary = pgTable(
  'itinerary',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    summary: text('summary'),
    destination: text('destination'),
    tags: text('tags').array(),
    coverImageUrl: text('cover_image_url'),
    status: itineraryStatus('status').default('draft').notNull(),
    visibility: itineraryVisibility('visibility').default('public').notNull(),
    inviteToken: text('invite_token'),
    forkedFromId: text('forked_from_id').references((): AnyPgColumn => itinerary.id, {
      onDelete: 'set null',
    }),
    ratingAvg: numeric('rating_avg'),
    ratingCount: integer('rating_count').default(0).notNull(),
    /**
     * Best-effort popularity signal: bumped once per public detail view by
     * a non-author (see `getItineraryBySlugImpl`). No per-user dedupe —
     * this feeds the landing page's "most viewed" shelf, not analytics.
     */
    viewCount: integer('view_count').default(0).notNull(),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('itinerary_status_visibility_idx').on(table.status, table.visibility)],
)

export const itineraryDay = pgTable(
  'itinerary_day',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    itineraryId: text('itinerary_id')
      .notNull()
      .references(() => itinerary.id, { onDelete: 'cascade' }),
    dayNumber: integer('day_number').notNull(),
    title: text('title'),
    note: text('note'),
  },
  (table) => [
    unique('itinerary_day_itinerary_id_day_number_unique').on(table.itineraryId, table.dayNumber),
  ],
)

export const stop = pgTable(
  'stop',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    dayId: text('day_id')
      .notNull()
      .references(() => itineraryDay.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    category: stopCategory('category').notNull(),
    description: text('description'),
    /** Optional display time for the day's timeline (e.g. '09:30'); order of truth stays `position`. */
    startTime: time('start_time'),
    costCents: integer('cost_cents'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    placeLabel: text('place_label'),
  },
  (table) => [index('stop_day_id_position_idx').on(table.dayId, table.position)],
)

export const favorite = pgTable(
  'favorite',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    itineraryId: text('itinerary_id')
      .notNull()
      .references(() => itinerary.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.itineraryId] })],
)

export const rating = pgTable(
  'rating',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    itineraryId: text('itinerary_id')
      .notNull()
      .references(() => itinerary.id, { onDelete: 'cascade' }),
    stars: integer('stars').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.itineraryId] })],
)

export const comment = pgTable('comment', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  itineraryId: text('itinerary_id')
    .notNull()
    .references(() => itinerary.id, { onDelete: 'cascade' }),
  authorId: text('author_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const itineraryMember = pgTable(
  'itinerary_member',
  {
    itineraryId: text('itinerary_id')
      .notNull()
      .references(() => itinerary.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.itineraryId, table.userId] })],
)
