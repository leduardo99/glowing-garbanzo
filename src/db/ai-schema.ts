import { nanoid } from 'nanoid'
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { user } from './auth-schema'

/**
 * One row per *successful* AI itinerary generation — the daily quota is
 * enforced by counting a user's rows for the current UTC day (see
 * `#/server/ai`). Failed generations never insert a row, so they don't
 * consume quota.
 */
export const aiGeneration = pgTable(
  'ai_generation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('ai_generation_user_id_created_at_idx').on(table.userId, table.createdAt)],
)
