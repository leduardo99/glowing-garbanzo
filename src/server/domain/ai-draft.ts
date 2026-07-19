/**
 * Pure building blocks for the AI itinerary draft generator (see
 * `#/server/ai` for the server function that wires them to the provider and
 * the database):
 *
 *   - `buildAiItinerarySchema` — the Zod schema handed to the AI SDK's
 *     `generateObject`, mirroring the domain shape (itinerary → days →
 *     stops). Built per request so the day count can be enforced by the
 *     schema itself (`length(dayCount)`) — a wrong-length response is a
 *     validation failure the caller retries/fails on, never silently
 *     accepted.
 *   - `buildGenerationPrompt` — the English instruction prompt; the
 *     generated *content* is requested in the user's active Paraglide
 *     locale.
 *   - `buildDraftRows` — maps a validated generation to insertable rows in
 *     the same nested shape the fork insert path uses (itinerary row plus
 *     days, each with position-sequenced stops).
 */
import { z } from 'zod'

export const AI_STYLE_OPTIONS = [
  'adventure',
  'food',
  'family',
  'budget',
  'romantic',
  'culture',
] as const

export type AiStyle = (typeof AI_STYLE_OPTIONS)[number]

const stopCategorySchema = z.enum(['attraction', 'food', 'lodging', 'transport', 'other'])

/** Zod schema for the model's structured output. `dayCount` fixes the exact number of days. */
export function buildAiItinerarySchema(dayCount: number) {
  return z.object({
    title: z.string().min(1).describe('Short, evocative itinerary title'),
    summary: z.string().min(1).describe('One-paragraph overview of the trip'),
    tags: z
      .array(z.string().min(1))
      .max(6)
      .describe('Lowercase topic tags, e.g. "beach", "museums"'),
    days: z
      .array(
        z.object({
          title: z.string().min(1).optional().describe('Theme of the day'),
          note: z.string().min(1).optional().describe('Practical tip for the day'),
          stops: z
            .array(
              z.object({
                name: z.string().min(1).describe('Name of the place or activity'),
                category: stopCategorySchema,
                description: z
                  .string()
                  .min(1)
                  .optional()
                  .describe('Why it is worth visiting, 1-2 sentences'),
                startTime: z
                  .string()
                  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
                  .optional()
                  .describe(
                    "Plausible visit time as 24h 'HH:MM' (e.g. '09:30'), in chronological order within the day; omit when unclear",
                  ),
                costCents: z
                  .number()
                  .int()
                  .nonnegative()
                  .optional()
                  .describe(
                    'Approximate cost per person in cents of the local currency; omit when free or unknown',
                  ),
              }),
            )
            .min(1)
            .max(8),
        }),
      )
      .length(dayCount),
  })
}

export type AiItineraryDraft = z.infer<ReturnType<typeof buildAiItinerarySchema>>

export interface GenerationPromptInput {
  destination: string
  dayCount: number
  styles: AiStyle[]
  preferences?: string
  /** Active Paraglide locale — the generated content's language. */
  locale: string
}

const LOCALE_LANGUAGE_NAMES: Record<string, string> = {
  'pt-BR': 'Brazilian Portuguese',
  en: 'English',
}

/**
 * Builds the instruction prompt. Always written in English (the reliable
 * instruction language); the *content* language follows the user's locale.
 */
export function buildGenerationPrompt(input: GenerationPromptInput): string {
  const language = LOCALE_LANGUAGE_NAMES[input.locale] ?? input.locale
  const lines = [
    `Create a realistic ${input.dayCount}-day travel itinerary for ${input.destination}.`,
    `The itinerary must have exactly ${input.dayCount} days.`,
    'Order each day\'s stops as a sensible route (morning to evening) with 3 to 6 stops per day.',
    'Prefer well-known, currently operating places; never invent addresses or prices you are not confident about.',
    `Write all user-facing text (title, summary, tags, day titles, notes, stop names and descriptions) in ${language}.`,
  ]
  if (input.styles.length > 0) {
    lines.push(`Trip style: ${input.styles.join(', ')}.`)
  }
  if (input.preferences?.trim()) {
    lines.push(`Traveler preferences: ${input.preferences.trim()}`)
  }
  return lines.join('\n')
}

/** Nested insert rows for a generated draft — same shape the fork transaction consumes. */
export interface DraftRows {
  itinerary: {
    authorId: string
    title: string
    summary: string
    destination: string
    tags: string[]
    slug: string
    status: 'draft'
  }
  days: Array<{
    dayNumber: number
    title: string | null
    note: string | null
    stops: Array<{
      position: number
      name: string
      category: 'attraction' | 'food' | 'lodging' | 'transport' | 'other'
      description: string | null
      startTime: string | null
      costCents: number | null
    }>
  }>
}

/** Maps a validated generation to insertable rows (sequential day numbers and stop positions). */
export function buildDraftRows(
  draft: AiItineraryDraft,
  { ownerId, destination, slug }: { ownerId: string; destination: string; slug: string },
): DraftRows {
  return {
    itinerary: {
      authorId: ownerId,
      title: draft.title,
      summary: draft.summary,
      destination,
      tags: draft.tags,
      slug,
      status: 'draft',
    },
    days: draft.days.map((day, dayIndex) => ({
      dayNumber: dayIndex + 1,
      title: day.title ?? null,
      note: day.note ?? null,
      stops: day.stops.map((stop, stopIndex) => ({
        position: stopIndex + 1,
        name: stop.name,
        category: stop.category,
        description: stop.description ?? null,
        startTime: stop.startTime ?? null,
        costCents: stop.costCents ?? null,
      })),
    })),
  }
}
