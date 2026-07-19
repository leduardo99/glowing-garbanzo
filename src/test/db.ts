import { config } from 'dotenv'
import { nanoid } from 'nanoid'
import { getTableName, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

import * as schema from '#/db/schema'

config({ path: ['.env.test'], override: true })

const TEST_DATABASE_URL = process.env.DATABASE_URL!
const TEST_DB_NAME = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, '')

if (TEST_DB_NAME !== 'itineraries_test') {
  throw new Error(
    `Refusing to run test db harness against database "${TEST_DB_NAME}" — expected "itineraries_test". ` +
      'Check for a stray DATABASE_URL environment variable overriding .env.test.',
  )
}

export const testDb = drizzle(TEST_DATABASE_URL, { schema })

/**
 * Creates the test database if it doesn't exist yet and runs every
 * pending drizzle migration against it. Safe to call repeatedly.
 */
export async function setupTestDb(): Promise<void> {
  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = '/postgres'
  const adminClient = new pg.Client({ connectionString: adminUrl.toString() })
  await adminClient.connect()
  try {
    await adminClient.query(`CREATE DATABASE "${TEST_DB_NAME}"`)
  } catch (error) {
    const isAlreadyExists =
      error instanceof Error && 'code' in error && (error as { code: string }).code === '42P04'
    if (!isAlreadyExists) throw error
  } finally {
    await adminClient.end()
  }

  await migrate(testDb, { migrationsFolder: './drizzle' })
}

/** Closes the underlying connection pool. Call once after all tests finish. */
export async function closeTestDb(): Promise<void> {
  await testDb.$client.end()
}

/** Truncates every domain and auth table, resetting identities. */
export async function resetTestDb(): Promise<void> {
  const tables = [
    schema.aiGeneration,
    schema.favorite,
    schema.rating,
    schema.comment,
    schema.itineraryMember,
    schema.stop,
    schema.itineraryDay,
    schema.itinerary,
    schema.verification,
    schema.account,
    schema.session,
    schema.user,
  ]
  const tableNames = tables.map((table) => `"${getTableName(table)}"`).join(', ')
  await testDb.execute(sql.raw(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`))
}

/** Inserts a row directly into the Better Auth `user` table for use in tests. */
export async function createTestUser(name = 'Test User'): Promise<{ id: string; email: string }> {
  const id = nanoid()
  const email = `test-${nanoid()}@example.com`
  await testDb.insert(schema.user).values({ id, name, email })
  return { id, email }
}
