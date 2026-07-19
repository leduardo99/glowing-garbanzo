import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Output, createTextStreamResponse, streamText, toTextStream } from 'ai'
import { createGoogle } from '@ai-sdk/google'

import { db } from '#/db'
import { env } from '#/env'
import { getOptionalSession } from '#/server/context'
import {
  ASSISTANT_MODEL,
  ASSISTANT_TIMEOUT_MS,
  adviseSchema,
  loadAssistantState,
} from '#/server/ai-assistant'
import { buildAssistantPrompt, assistantResponseSchema } from '#/server/domain/ai-patch'
import { requireItineraryAuthor } from '#/server/shared'

/**
 * Streaming endpoint for the editor's AI assistant (AI SDK pattern:
 * `streamText` + `Output.object` server-side, `useObject` client-side —
 * see AssistantPanel). The reply streams in as it generates instead of
 * arriving in one block; the final chunk completes the structured object
 * (reply + optional patch) that the client validates against the same
 * shared Zod schema.
 *
 * Auth, authorship, prompt, and state serialization are the exact
 * ingredients `adviseItineraryChangeImpl` uses (and tests cover) — this
 * route only changes the transport. Asking remains quota-free; applying
 * a patch still goes through the transactional `applyItineraryPatch`.
 *
 * The client sends its own locale: paraglide's request-scoped
 * `getLocale()` is only guaranteed inside server functions, and the
 * language of the reply is client-observable state anyway.
 */
const bodySchema = adviseSchema.extend({
  locale: z.string().min(2).max(10),
})

export const Route = createFileRoute('/api/assistant')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getOptionalSession(request)
        if (!session) {
          return new Response('UNAUTHORIZED', { status: 401 })
        }

        const parsed = bodySchema.safeParse(await request.json())
        if (!parsed.success) {
          return new Response('BAD_REQUEST', { status: 400 })
        }
        const input = parsed.data

        try {
          await requireItineraryAuthor(db, session, input.itineraryId)
        } catch {
          // Same "don't leak existence" collapse the editor route uses.
          return new Response('NOT_FOUND', { status: 404 })
        }

        const apiKey = env.GEMINI_API_KEY
        if (!apiKey) {
          return new Response('AI_GENERATION_FAILED', { status: 503 })
        }

        const state = await loadAssistantState(db, input.itineraryId)
        const prompt = buildAssistantPrompt({
          state,
          messages: input.messages,
          locale: input.locale,
        })

        const result = streamText({
          model: createGoogle({ apiKey })(ASSISTANT_MODEL),
          output: Output.object({ schema: assistantResponseSchema }),
          prompt,
          abortSignal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
        })

        return createTextStreamResponse({
          stream: toTextStream({ stream: result.stream }),
        })
      },
    },
  },
})
