/**
 * Cover image upload: client-safe constants plus the `uploadCover` server
 * function itself.
 *
 * This file is reachable from client code (`MetadataForm` imports the error
 * sentinels and `MAX_COVER_BYTES` from here to pre-check a file before
 * uploading it), so it deliberately stays free of Node built-ins
 * (`node:fs/promises`, `node:path`) and any disk/Blob storage logic. The
 * actual storage implementation — `uploadCoverImpl`, `diskStorage`,
 * `vercelBlobStorage`, `selectStorage`, `resolveUploadPath`,
 * `contentTypeForExtension` — lives in `./uploads.server.ts`, a
 * `*.server.ts`-suffixed file that TanStack Start's import-protection
 * plugin keeps out of the client bundle. See that file's doc comment for
 * why the split exists (it fixes
 * `docs/superpowers/notes/2026-07-19-smoke-inventory.md` row 1: the two
 * used to be one file, so any client import here dragged
 * `node:fs/promises` into the browser's module graph).
 *
 * Follows the same `*Impl(db, session, input)` / thin `createServerFn`
 * wrapper pattern documented at the top of `itineraries.ts`, including the
 * three-sentinel error convention (see `./errors`) for the author-only
 * check. Two upload-specific failure modes (`FILE_TOO_LARGE`,
 * `INVALID_FILE_TYPE`) are local to this module — they aren't part of the
 * shared access-control sentinel set.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { db as appDb } from '#/db'
import { env } from '#/env'
import { getSessionOrThrow } from './context'
import { uploadCoverImpl } from './uploads.server'

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
