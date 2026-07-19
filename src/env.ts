import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
    /** Directory where uploaded files (e.g. cover images) are stored on disk. */
    UPLOADS_DIR: z.string().min(1).default('./uploads'),
    /**
     * Vercel Blob read/write token. Disk writes don't persist on Vercel's
     * serverless filesystem, so its presence switches cover-image uploads
     * from disk storage to Vercel Blob storage (see `#/server/uploads`).
     * Unset in local/self-hosted deployments, where disk storage is used.
     */
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    /**
     * Google AI Studio API key for the AI itinerary generator (Gemini Flash
     * free tier via the Vercel AI SDK — see `#/server/ai`). Optional: when
     * unset, the "generate with AI" mode on `/new` is hidden entirely.
     */
    GEMINI_API_KEY: z.string().min(1).optional(),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
  },

  /**
   * What object holds the environment variables at runtime.
   *
   * Vite only populates `import.meta.env` with `VITE_`-prefixed vars (plus
   * its own built-ins) — it never forwards arbitrary process env vars into
   * it, even on the server. Server-only vars therefore have to be read from
   * `process.env` directly, while client vars keep coming from
   * `import.meta.env` (the only place Vite actually exposes them, including
   * in the client bundle). Listed explicitly (rather than spreading either
   * object) so each var's source is unambiguous.
   */
  runtimeEnv: {
    SERVER_URL: process.env.SERVER_URL,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    VITE_APP_TITLE: import.meta.env.VITE_APP_TITLE,
  },

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
})
