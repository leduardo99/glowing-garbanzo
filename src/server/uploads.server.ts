/**
 * Cover image storage implementation: disk/Vercel Blob back ends, the
 * magic-byte sniffer, and `uploadCoverImpl` (the actual per-request logic
 * behind `./uploads.ts`'s `uploadCover` server function).
 *
 * Split out of `uploads.ts` into its own `*.server.ts` file so TanStack
 * Start's import-protection plugin keeps this file — and its
 * `node:fs/promises` / `node:path` imports — out of the client module
 * graph entirely. Previously all of this lived in `uploads.ts` alongside a
 * few client-safe exports (error sentinels, `MAX_COVER_BYTES`); the client
 * component that only needed those constants (`MetadataForm`) imported
 * from the same file, so the whole module — including the top-level
 * `node:fs/promises` import — was reachable from the client bundle for
 * `/my/$id/edit`. TanStack Start's `createServerFn` compiler strips a
 * `.handler()` body for the client build, but it has no way to know that
 * *other*, non-`createServerFn`-wrapped exports in the same file (this
 * module's storage helpers) are also server-only, so it left the Node
 * built-in imports in place. Vite's client externalization stub for
 * `node:fs/promises` throws the moment its named exports are bound, which
 * happened as soon as the module loaded — hence the dev-only 53-occurrence
 * cascade on `/my/$id/edit` (production's build-time tree-shaking happened
 * to prune the same dead path, silencing it there, but the boundary defect
 * was present in both). See
 * `docs/superpowers/notes/2026-07-19-smoke-inventory.md` row 1.
 *
 * The `.server.ts` suffix opts this file into Start's default
 * `**\/*.server.*` import-protection rule: if client code ever reaches it
 * (even transitively), the plugin swaps it for an inert mock instead of
 * bundling the real thing — so the real `node:fs/promises` / `node:path`
 * imports are never evaluated client-side. Values the client legitimately
 * needs with their *real* runtime value (the error sentinels client code
 * compares against, `MAX_COVER_BYTES`) stay in `uploads.ts`, never here —
 * a mocked export would be a Proxy, not the real string/number.
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
import { nanoid } from 'nanoid'

import type * as schema from '#/db/schema'
import { itinerary } from '#/db/schema'
import {
  ERR_BLOB_STORAGE_NOT_CONFIGURED,
  ERR_FILE_TOO_LARGE,
  ERR_INVALID_FILE_TYPE,
  MAX_COVER_BYTES,
} from './uploads'
import type { SessionUser } from './itineraries'
import { requireItineraryAuthor } from './shared'

type Database = NodePgDatabase<typeof schema>

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
