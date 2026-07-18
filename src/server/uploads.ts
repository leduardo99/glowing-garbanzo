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
 *
 * Storage:
 *   - Vercel's serverless functions have no persistent (or shared-across-
 *     instances) local disk, so what actually stores the bytes is behind
 *     the `Storage` interface below. `diskStorage` (default) is the
 *     existing on-disk behavior served back by the `/api/uploads/$` route.
 *     `vercelBlobStorage`, selected automatically when `BLOB_READ_WRITE_TOKEN`
 *     is set (see DEPLOY.md), uploads to Vercel Blob and returns its own
 *     absolute URL instead — the client only ever sees `coverImageUrl` as an
 *     opaque URL, so this doesn't require any UI change. On Vercel with no
 *     token, `selectStorage` throws `ERR_BLOB_STORAGE_NOT_CONFIGURED` rather
 *     than falling back to `diskStorage`, which would EROFS-crash there.
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
/**
 * Thrown by `selectStorage` when running on Vercel (`isVercel: true`) with
 * no `blobReadWriteToken`. Vercel's serverless functions have a read-only
 * filesystem outside `/tmp`, so silently falling back to `diskStorage`
 * there would EROFS-crash on the first write instead of failing with a
 * clear, actionable error.
 */
export const ERR_BLOB_STORAGE_NOT_CONFIGURED = 'BLOB_STORAGE_NOT_CONFIGURED'

/**
 * Vercel's request-body limit for serverless functions is ~4.5 MB and
 * rejects with a platform-level 413 *before* app code runs. Staying under
 * that (with headroom for multipart overhead) means our own validation is
 * the one that actually fires, with a clear error, instead of the request
 * never reaching this code at all. Exported so the client (the cover
 * upload UI) can pre-check a file client-side and skip a doomed request —
 * see `maybeDownscaleCoverImage` / `MetadataForm`.
 */
export const MAX_COVER_BYTES = 4 * 1024 * 1024 // 4 MB

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
export function resolveUploadPath({ uploadsDir, requested }: { uploadsDir: string; requested: string }): string | null {
  const base = path.resolve(uploadsDir)
  const resolved = path.resolve(base, requested)
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  if (!resolved.startsWith(prefix)) {
    return null
  }
  return resolved
}

export interface StoragePutInput {
  filename: string
  bytes: Uint8Array
  contentType: string
}

/**
 * Storage back end used by `uploadCoverImpl` to persist a validated cover
 * image. `filename` is already a unique, extension-carrying nanoid — no
 * implementation needs to invent its own naming scheme.
 */
export interface Storage {
  /** Stores the bytes and returns the URL the stored file is reachable at. */
  put: (input: StoragePutInput) => Promise<string>
}

/**
 * Default storage: writes to `uploadsDir` on local disk, served back by the
 * `/api/uploads/$` route. Works anywhere the process has a persistent,
 * writable filesystem — not on Vercel's serverless functions.
 */
export function diskStorage(uploadsDir: string): Storage {
  return {
    async put({ filename, bytes }) {
      await mkdir(uploadsDir, { recursive: true })
      await writeFile(path.join(uploadsDir, filename), bytes)
      return `/api/uploads/${filename}`
    },
  }
}

/**
 * Vercel Blob storage, selected automatically when `BLOB_READ_WRITE_TOKEN`
 * is set (see DEPLOY.md). `addRandomSuffix: false` because `filename` is
 * already a nanoid — Blob's own collision-avoidance suffix would just be
 * redundant. Returns Blob's own absolute URL; there is no `/api/uploads`
 * serving route involved for this path.
 */
export function vercelBlobStorage(): Storage {
  return {
    async put({ filename, bytes, contentType }) {
      const { put } = await import('@vercel/blob')
      const blob = await put(filename, Buffer.from(bytes), {
        access: 'public',
        addRandomSuffix: false,
        contentType,
      })
      return blob.url
    },
  }
}

/**
 * Picks the storage implementation for a single upload: Vercel Blob when a
 * `blobReadWriteToken` is available, disk otherwise — except on Vercel
 * (`isVercel: true`) with no token, where disk storage would EROFS-crash on
 * the platform's read-only filesystem, so this throws
 * `ERR_BLOB_STORAGE_NOT_CONFIGURED` instead of silently picking a storage
 * that can't work. Kept as a pure function (no direct `process.env` access
 * — `isVercel` is a plain flag the caller supplies) so it's unit-testable
 * without touching `process.env` or the network — see `uploads.test.ts`.
 */
export function selectStorage({
  uploadsDir,
  blobReadWriteToken,
  isVercel,
}: {
  uploadsDir: string
  blobReadWriteToken: string | undefined
  isVercel: boolean
}): Storage {
  if (blobReadWriteToken) {
    return vercelBlobStorage()
  }
  if (isVercel) {
    throw new Error(ERR_BLOB_STORAGE_NOT_CONFIGURED)
  }
  return diskStorage(uploadsDir)
}

export interface UploadCoverInput {
  itineraryId: string
  bytes: Uint8Array
  originalName: string
  declaredMime: string
  uploadsDir: string
  /** Selects `vercelBlobStorage` over `diskStorage` when present (see `selectStorage`). */
  blobReadWriteToken?: string
  /**
   * Whether this process is running on Vercel (`process.env.VERCEL`, read
   * by the `uploadCover` wrapper — see `selectStorage`). Defaults to
   * `false` so existing (local/self-hosted) callers are unaffected.
   */
  isVercel?: boolean
}

export interface UploadCoverResult {
  url: string
}

/**
 * Validates and stores a cover image, then updates the itinerary's
 * `coverImageUrl`. Author only (see `requireItineraryAuthor`). Replacing an
 * existing cover simply overwrites `coverImageUrl`; the previous file (on
 * disk or in Blob storage) is left in place (not deleted) — see the design
 * doc's Risks section.
 */
export async function uploadCoverImpl(
  db: Database,
  session: SessionUser | null,
  input: UploadCoverInput,
): Promise<UploadCoverResult> {
  await requireItineraryAuthor(db, session, input.itineraryId)

  if (input.bytes.byteLength > MAX_COVER_BYTES) {
    throw new Error(ERR_FILE_TOO_LARGE)
  }

  // `input.declaredMime` (and `input.originalName`) are attacker-controlled
  // and deliberately ignored for validation — only the sniffed bytes decide
  // the stored type and extension.
  const sniffed = sniffImageType(input.bytes)
  if (!sniffed) {
    throw new Error(ERR_INVALID_FILE_TYPE)
  }

  const extension = EXTENSION_BY_TYPE[sniffed]
  const filename = `${nanoid()}.${extension}`
  const storage = selectStorage({
    uploadsDir: input.uploadsDir,
    blobReadWriteToken: input.blobReadWriteToken,
    isVercel: input.isVercel ?? false,
  })
  const url = await storage.put({ filename, bytes: input.bytes, contentType: contentTypeForExtension(extension) })

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
    return uploadCoverImpl(appDb, session, {
      itineraryId: data.itineraryId,
      bytes,
      originalName: data.file.name,
      declaredMime: data.file.type,
      uploadsDir: env.UPLOADS_DIR,
      blobReadWriteToken: env.BLOB_READ_WRITE_TOKEN,
      // `VERCEL` is a platform-provided runtime flag, not app config, so
      // it's read directly here rather than added to `env.ts` — see
      // `selectStorage`'s doc comment.
      isVercel: Boolean(process.env.VERCEL),
    })
  })
