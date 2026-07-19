# Design: AI itinerary draft generator

Date: 2026-07-19
Status: approved (brainstorming session with the user on 2026-07-19)

## Vision

Turn the empty `/new` form into an instant starting point: the user describes the trip (destination, days, style) and gets a complete draft itinerary — days and stops in our domain shape — that opens in the existing editor for adjustment. AI assists creation; the editor remains the source of truth.

## Decisions (from brainstorming)

- **Entry point**: `/new` gains two modes — "start from scratch" (current flow) and "generate with AI".
- **Provider**: **Gemini Flash free tier** (~1,500 req/day app-wide, native structured output) via the **Vercel AI SDK** (`ai` + `@ai-sdk/google`, `generateObject` with our Zod schema). Provider swap (Groq/Mistral) is a one-import change if the free tier tightens.
- **Quota**: **5 successful generations per user per day**, enforced server-side; failures don't consume quota.
- **Inputs**: destination, day count (1–14), style chips (adventure/food/family/budget/romantic/culture), optional free-text preferences, and an opt-in **"try to locate stops on the map"** checkbox.
- **Geocoding**: only when opted in — best-effort server-side Nominatim (1 req/s throttle, ~15-stop cap, silent per-stop failure). Without opt-in, stops have no pins and the editor's PlacePicker covers it.

## Server (`src/server/ai.ts`)

`generateItineraryDraftImpl(db, session, input)` + thin `createServerFn` wrapper, following every existing convention (sentinels from `#/server/errors`, shared helpers, options-object rule):

1. Require session (`ERR_UNAUTHORIZED`).
2. Quota check: new table **`ai_generation`** (`id` nanoid PK, `userId` FK cascade, `createdAt`) in `src/db/` re-exported by `schema.ts`; count today's rows for the user (UTC day); ≥5 → throw `AI_QUOTA_EXCEEDED` (new sentinel in `errors.ts`).
3. Call `generateObject` (model `gemini-flash` family via `@ai-sdk/google`) with a Zod schema mirroring the domain: `{ title, summary, tags: string[], days: [{ title?, note?, stops: [{ name, category (our enum), description?, costCents? }] }] }`. Prompt in English; instructs content in the user's active Paraglide locale; day count must equal `input.days`. 60s timeout; 1 retry on schema-validation failure; provider/validation failure → `AI_GENERATION_FAILED` (no quota consumed).
4. Persist by reusing the fork insert path's transaction shape (draft itinerary via `makeSlug`, days, stops with sequential positions). Record the `ai_generation` row in the same transaction.
5. If `input.geocode`: after commit, best-effort Nominatim per stop (`name + destination`), writing lat/lng/placeLabel for hits; capped and throttled; never fails the request.
6. Return `{ id }`; client navigates to `/my/$id/edit`.

Also: `getAiAvailability` server fn → `{ enabled, remainingToday }` (enabled = `GEMINI_API_KEY` present). Key added to `env.ts` (server section, optional) and documented in `DEPLOY.md`; without it the AI mode is hidden.

## UI (`/new`)

Two cards/tabs. AI mode: destination input, day stepper, style chips (multi), preferences textarea, geocode checkbox, generate button with progress state (5–15s expected) and the discreet "X generations left today" counter (from `getAiAvailability`). Errors as specific i18n toasts/messages: quota exhausted, provider unavailable, invalid output. All copy via Paraglide in both locales. Follows DESIGN.md tokens; mobile-first.

## Errors

- `AI_QUOTA_EXCEEDED` → friendly message with reset expectation (tomorrow).
- `AI_GENERATION_FAILED` → retry suggestion; quota untouched.
- Provider key missing → mode hidden (never a broken button).
- Geocoding failures are invisible (stops simply lack pins).

## Tests (Vitest)

- Unit: quota counting (day boundary, 5th vs 6th), schema→insert-rows mapping (pure helper), prompt builder.
- Integration: `generateItineraryDraftImpl` with the AI SDK **mocked** (module mock) — success persists itinerary+days+stops+quota row in one transaction; quota exceeded throws before provider call; invalid model output → `AI_GENERATION_FAILED` and no rows.
- No test touches the network (dev proxy blocks the provider; live verification happens post-deploy).

## Out of scope

Chat-based iterative refinement; fork-adaptation via AI; AI translation/summaries; semantic search; per-user API keys; paid-tier fallback.

## Risks

- **Shared free tier**: 5/day × users can exceed 1,500/day globally at scale — acceptable now; mitigation later is a global daily counter or paid tier.
- **Model quality/pt-BR content**: mitigated by structured output + editor review before publishing (drafts are never public automatically).
- **Nominatim mismatch pins**: opt-in only, editor-correctable.
