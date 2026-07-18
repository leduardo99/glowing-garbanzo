import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { contentTypeForExtension, resolveUploadPath } from '#/server/uploads'

/**
 * Serves uploaded files (currently just cover images) from `UPLOADS_DIR`.
 * 404s both for a missing file and for any requested path that
 * `resolveUploadPath` determines would resolve outside `UPLOADS_DIR`
 * (path traversal) — the two cases are indistinguishable to the caller by
 * design, same as the itinerary access-leak convention.
 */
export const Route = createFileRoute('/api/uploads/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const requested = params._splat
        if (!requested) {
          return new Response('Not found', { status: 404 })
        }

        const resolved = resolveUploadPath(env.UPLOADS_DIR, requested)
        if (!resolved) {
          return new Response('Not found', { status: 404 })
        }

        let size: number
        try {
          const stats = await stat(resolved)
          if (!stats.isFile()) {
            return new Response('Not found', { status: 404 })
          }
          size = stats.size
        } catch {
          return new Response('Not found', { status: 404 })
        }

        const extension = resolved.split('.').pop() ?? ''
        const stream = Readable.toWeb(createReadStream(resolved)) as ReadableStream

        return new Response(stream, {
          headers: {
            'Content-Type': contentTypeForExtension(extension),
            'Content-Length': String(size),
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
