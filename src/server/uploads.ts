/**
 * Cover image upload and lookup helpers.
 *
 * Follows the same `*Impl(db, session, input)` / thin `createServerFn`
 * wrapper pattern documented at the top of `itineraries.ts`, including the
 * three-sentinel error convention (see `./errors`) for the author-only
 * check. Two upload-specific failure modes (`FILE_TOO_LARGE`,
 * `INVALID_FILE_TYPE`) are local to this module — they aren't part of the
 * shared access-control sentinel set.
 *
 * Security notes:
 *   - The stored file's extension (and therefore its served content-type)
 *     is derived from *sniffing the magic bytes*, never from the client's
 *     declared MIME type or the original filename — both are trivially
 *     spoofable.
 *   - `resolveUploadPath` is the single choke point the serving route uses
 *     to turn a requested filename into an on-disk path; it rejects
 *     anything that would resolve outside `uploadsDir` (path traversal).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { nanoid } from 'nanoid'

import { db as appDb } from '#/db'
import type * as schema from '#/db/schema'
import { itinerary } from '#/db/schema'
import { env } from '#/env'
import { getSessionOrThrow } from './context'
import type { SessionUser } from './itineraries'
import { requireItineraryAuthor } from './shared'

type Database = NodePgDatabase<typeof schema>

export const ERR_FILE_TOO_LARGE = 'FILE_TOO_LARGE'
export const ERR_INVALID_FILE_TYPE = 'INVALID_FILE_TYPE'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

type SniffedType = 'jpeg' | 'png' | 'webp'

/** Extension used for the stored filename, keyed by sniffed magic bytes. */
const EXTENSION_BY_TYPE: Record<SniffedType, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
}

/** Content-type served for each extension `resolveUploadPath` can produce. */
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** Returns the `Content-Type` for a stored file's extension (case-insensitive). */
export function contentTypeForExtension(extension: string): string {
  return CONTENT_TYPE_BY_EXTENSION[extension.toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Sniffs the first bytes of a buffer against the jpeg/png/webp magic-byte
 * signatures. Returns `null` for anything else (including a spoofed
 * declared MIME type whose actual bytes don't match).
 */
function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'webp'
  }

  return null
}

/**
 * Resolves a requested (splat) path to an absolute file path inside
 * `uploadsDir`, or `null` if it would resolve outside of it — the path
 * traversal guard used by the `/api/uploads/$` serving route. Pure and
 * synchronous so it's directly unit-testable without touching disk.
 */
export function resolveUploadPath(uploadsDir: string, requested: string): string | null {
  const base = path.resolve(uploadsDir)
  const resolved = path.resolve(base, requested)
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  if (!resolved.startsWith(prefix)) {
    return null
  }
  return resolved
}

export interface UploadCoverInput {
  itineraryId: string
  bytes: Uint8Array
  originalName: string
  declaredMime: string
}

export interface UploadCoverResult {
  url: string
}

/**
 * Validates and stores a cover image, then updates the itinerary's
 * `coverImageUrl`. Author only (see `requireItineraryAuthor`). Replacing an
 * existing cover simply overwrites `coverImageUrl`; the previous file on
 * disk is left in place (not deleted) — see the design doc's Risks section.
 */
export async function uploadCoverImpl(
  db: Database,
  session: SessionUser | null,
  input: UploadCoverInput,
  uploadsDir: string,
): Promise<UploadCoverResult> {
  await requireItineraryAuthor(db, session, input.itineraryId)

  if (input.bytes.byteLength > MAX_BYTES) {
    throw new Error(ERR_FILE_TOO_LARGE)
  }

  // `input.declaredMime` (and `input.originalName`) are attacker-controlled
  // and deliberately ignored for validation — only the sniffed bytes decide
  // the stored type and extension.
  const sniffed = sniffImageType(input.bytes)
  if (!sniffed) {
    throw new Error(ERR_INVALID_FILE_TYPE)
  }

  const filename = `${nanoid()}.${EXTENSION_BY_TYPE[sniffed]}`
  await mkdir(uploadsDir, { recursive: true })
  await writeFile(path.join(uploadsDir, filename), input.bytes)

  const url = `/api/uploads/${filename}`
  await db.update(itinerary).set({ coverImageUrl: url }).where(eq(itinerary.id, input.itineraryId))

  return { url }
}

const uploadCoverValidator = (data: unknown): { itineraryId: string; file: File } => {
  if (!(data instanceof FormData)) {
    throw new Error('Expected FormData')
  }
  const itineraryId = data.get('itineraryId')
  const file = data.get('file')
  if (typeof itineraryId !== 'string' || itineraryId.length === 0) {
    throw new Error('itineraryId is required')
  }
  if (!(file instanceof File)) {
    throw new Error('file is required')
  }
  return { itineraryId, file }
}

export const uploadCover = createServerFn({ method: 'POST' })
  .validator(uploadCoverValidator)
  .handler(async ({ data }) => {
    const session = await getSessionOrThrow(getRequest())
    const bytes = new Uint8Array(await data.file.arrayBuffer())
    return uploadCoverImpl(
      appDb,
      session,
      {
        itineraryId: data.itineraryId,
        bytes,
        originalName: data.file.name,
        declaredMime: data.file.type,
      },
      env.UPLOADS_DIR,
    )
  })
