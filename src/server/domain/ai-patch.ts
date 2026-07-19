/**
 * Structured revision ops for the editor's AI assistant (Route Studio
 * phase 4). The model never mutates anything directly: it proposes a
 * `patch` — a list of ops validated by this schema — the author previews
 * it as a diff card, and only "Aplicar" persists it (transactionally, in
 * ai-assistant.ts). Zod is the safety boundary: anything outside this
 * shape is rejected before any write.
 *
 * Ops reference days by their CURRENT dayNumber and stops by their
 * 1-based position within that day, and are applied in order against the
 * evolving state (an `add_day` makes the new day addressable by the next
 * op). Day removal renumbers subsequent days; stop removal compacts
 * positions — same invariants the manual editor keeps.
 */
import { z } from 'zod'

const stopCategorySchema = z.enum([
  'attraction',
  'food',
  'lodging',
  'transport',
  'other',
])

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe("24h 'HH:MM'")

const stopFieldsSchema = {
  name: z.string().min(1),
  category: stopCategorySchema,
  description: z.string().nullable(),
  startTime: timeSchema.nullable(),
  costCents: z.number().int().nonnegative().nullable(),
}

export const patchOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('set_title'),
    title: z.string().min(1),
  }),
  z.object({
    op: z.literal('set_summary'),
    summary: z.string().nullable(),
  }),
  z.object({
    op: z.literal('add_day'),
    title: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  }),
  z.object({
    op: z.literal('update_day'),
    dayNumber: z.number().int().positive(),
    title: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  }),
  z.object({
    op: z.literal('remove_day'),
    dayNumber: z.number().int().positive(),
  }),
  z.object({
    op: z.literal('add_stop'),
    dayNumber: z.number().int().positive(),
    name: stopFieldsSchema.name,
    category: stopFieldsSchema.category,
    description: stopFieldsSchema.description.optional(),
    startTime: stopFieldsSchema.startTime.optional(),
    costCents: stopFieldsSchema.costCents.optional(),
  }),
  z.object({
    op: z.literal('update_stop'),
    dayNumber: z.number().int().positive(),
    /** 1-based position of the stop within the day. */
    position: z.number().int().positive(),
    name: stopFieldsSchema.name.optional(),
    category: stopFieldsSchema.category.optional(),
    description: stopFieldsSchema.description.optional(),
    startTime: stopFieldsSchema.startTime.optional(),
    costCents: stopFieldsSchema.costCents.optional(),
  }),
  z.object({
    op: z.literal('remove_stop'),
    dayNumber: z.number().int().positive(),
    position: z.number().int().positive(),
  }),
])

export type PatchOp = z.infer<typeof patchOpSchema>

export const patchOpsSchema = z.array(patchOpSchema).min(1).max(30)

/** The assistant's structured answer: a conversational reply, plus an optional proposed patch. */
export const assistantResponseSchema = z.object({
  reply: z
    .string()
    .min(1)
    .describe("Conversational answer in the user's language, 1-3 sentences"),
  patch: z
    .object({
      summary: z
        .string()
        .min(1)
        .describe("One-sentence summary of the change, in the user's language"),
      ops: patchOpsSchema,
    })
    .nullable()
    .describe('The proposed change as ops, or null when just conversing'),
})

export type AssistantResponse = z.infer<typeof assistantResponseSchema>

export interface AssistantDayState {
  dayNumber: number
  title: string | null
  note: string | null
  stops: Array<{
    position: number
    name: string
    category: z.infer<typeof stopCategorySchema>
    description: string | null
    startTime: string | null
    costCents: number | null
  }>
}

/** Compact serialization of the itinerary the model revises — small, stable, and position-1-based to match the op addressing. */
export function serializeItineraryState(state: {
  title: string
  summary: string | null
  destination: string | null
  currency: string
  days: AssistantDayState[]
}): string {
  return JSON.stringify(state)
}

export function buildAssistantPrompt({
  state,
  messages,
  locale,
}: {
  state: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  locale: string
}): string {
  const transcript = messages
    .map((msg) => `${msg.role === 'user' ? 'USER' : 'ASSISTANT'}: ${msg.content}`)
    .join('\n')
  return [
    'You are the itinerary assistant inside Roteiros, a travel itinerary editor.',
    'You revise the itinerary below through structured ops, or answer questions about it.',
    `Reply in the language of locale "${locale}".`,
    '',
    'Rules for ops:',
    '- Reference days by their current dayNumber and stops by their 1-based position, exactly as in the state below.',
    '- Ops apply in order against the evolving state (an add_day makes a new day addressable by later ops).',
    "- Only propose a patch when the user asked for a change; otherwise set patch to null and just answer.",
    '- Keep stop costs in the itinerary currency, as integer cents.',
    '- startTime values are 24h HH:MM and should be chronological within a day.',
    '',
    `CURRENT ITINERARY STATE: ${state}`,
    '',
    'CONVERSATION SO FAR:',
    transcript,
  ].join('\n')
}
