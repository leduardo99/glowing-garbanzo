# Route Studio — development plan

**Date:** 2026-07-19 · **Status:** IMPLEMENTED — phase 0 (#39), phase 1 (#40), phase 2 (#41), phase 3 (#42), phase 4 (#43); each merged to main with full gates
**Flow:** superpowers brainstorm → this plan → one branch + PR per phase
**Skills per phase:** impeccable (product register) + interface-design + vercel-react-best-practices + vercel-composition-patterns + web-design-guidelines; TanStack Intent guidance (AGENTS.md) before touching router/start code; shadcn skill for new primitives (sheet, tabs, command).

## Vision

Roteiros becomes a **route studio**: the map stops being an illustration inside pages and becomes the surface the app works on. Panels float over it in the app's own language (bright cream cards, quiet shadows, the drawn amber route), and the same signature carries discovery → detail → editing → AI assistance. Chrome stays quiet; the trip is always the protagonist.

## Inspiration synthesis (9 references)

**Adopted:**
- *OrbitTrip (desktop/mobile)* — the map-as-workspace structure: full-viewport map, floating search/results panel, collapsible; a conversational travel assistant attached to the work surface; price summary sheet on mobile.
- *Sage/cream mobile* — trip itinerary as **day tabs + vertical timeline with per-stop times and category icons**; chip-row shelf filters (top rated / most viewed already exist on our landing/server).
- *Lime mobile* — the **filter bottom-sheet** pattern (ranged slider + chip groups + "Show N results" CTA); floating badges on photo cards (we already do this).
- *Travelora (landing)* — **the product as the imagery**: real app UI (trip card, timeline, map) floating as a collage; quiet social proof line; destination chips under the CTA; problem/solution storytelling.
- *Trippin' (landing)* — feature storytelling bands (AI planning / personalization / booking → ours: AI generation / forking / map+timeline) and the FAQ accordion. Not its illustration system.
- *BonSanté (auth desktop)* — split-screen validated; **locale switcher on the auth page itself** (ours currently hides with the header — a real gap) and the floating content card over the brand panel.
- *AI travel app (auth mobile, dark/lime)* — the mobile form structure: centered brand mark, welcome + subtitle, labeled fields, forgot-password link, "or continue with" divider + social buttons, sign-up hand-off line. Its lime palette and orb are rejected per identity.

**Rejected (identity):** lime/marker-highlight palette and any second accent (One Green Voice Rule); OrbitTrip's desktop app sidebar (our quiet header + bottom tabs stay); floating pill bottom nav (author decision: keep the uniform 4-tab bar); glassmorphism-as-decoration; Trippin's illustrated-mascot/full-scene style (no illustration assets; sketchy SVG is a banned fallback — our legitimate illustration is the drawn route and the real map/product).

## Decisions locked (owner Q&A, 2026-07-19)

1. Scope: all four fronts — explore workspace, detail day tabs + times, editor map-first, mobile filter sheet.
2. AI assistant: **in the active plan**, living in **the editor + `/new`** (creates drafts and refines the open itinerary; `/new` is an entry point to the same chat). No discovery assistant in `/explore` for now.
3. Schema: **per-stop start time** and **budget = per-stop cost with computed totals** (note: `stop.cost_cents` + `stop.category` already exist — budget work is currency + aggregation + filters, not a new cost column).
4. Currency: **per-itinerary currency selector** (BRL default). Cross-currency price filtering is explicitly out: the explore budget filter applies together with a currency choice (default BRL); badges always render in the itinerary's own currency via `Intl.NumberFormat`.
5. Mobile navigation: keep the current fixed 4-tab bar.
6. Phase order approved as below; each phase is its own branch + PR, with the full gate set (`pnpm lint`, `tsc --noEmit`, `pnpm build`, `pnpm test`) and Playwright screenshot verification (light/dark × 390/1440) before push.
7. Landing + auth v3 (second Q&A, same day): hero goes **hybrid** (keep the drenched fold + route draw-in, replace the lone sketch with a floating product collage); landing gains feature bands, FAQ, destination chips + quiet social proof; auth gains a live product panel, community numbers, and **Google social login**, plus micro-polish. Runs **first, as Phase 0**.

## Design guardrails (all phases)

- Trilha Tropical invariants: mata as the only authoritative color; amber scoped to stars + drawn route; coral scoped to favorites; Fraunces for content titles only; cards float (shadow, never border+shadow); AA re-verified when any new pair appears.
- Floating panels over the map use the existing elevation vocabulary (`shadow-elevated` for the workspace panel — it is a popover-class surface).
- Map ink stays the fixed light-tuned hexes (tiles are always light); panel chrome follows the theme.
- Reduced motion, ≥44px targets, pt-BR string length tolerance, `tabular-nums` on all dynamic numbers (times, costs).
- Composition rules: no boolean-prop proliferation on panels (compound components + context per vercel-composition-patterns); heavy modules (`maplibre-gl`, AI chat panel) stay lazy (`bundle-dynamic-imports`); loader-driven data, no client waterfalls (`async-parallel`).

## Schema changes (introduced by the phase that needs them)

| Change | Phase | Notes |
| --- | --- | --- |
| `stop.start_time` (`time`, nullable) | 2 | Optional; timeline sorts by `position` (authoring order stays the truth), time is display metadata. AI draft schema gains optional `startTime`. |
| `itinerary.currency` (`char(3)`, default `'BRL'`) | 3 | ISO 4217; editor selector; `Intl.NumberFormat(locale, {currency})` everywhere costs render. |
| Computed day/trip totals | 3 | Derived in queries (SUM over `cost_cents`), never stored. Explore filter: budget range + currency (default BRL). |

## Phases

### Phase 0 — Landing & auth v3 (product-forward)
*Branch: `feat/landing-auth-v3`*

Landing (builds on the journey composition from PR #38 — nothing regresses):
- **Hero goes hybrid:** the drenched mata fold and the animated route draw-in stay; the right column's lone sketch becomes a **floating product collage** — real, hand-composed UI specimens (an `ItineraryCard`, a timeline fragment with numbered discs, a mini map-with-route panel) rendered as actual components with our card shadows, slightly rotated/stacked, the drawn route threading behind them. Static data via fixtures, not screenshots (crisp at any DPR, themeable, translatable).
- **Feature bands (3):** AI generation ("descreva a viagem, receba o rascunho"), forking ("comece do roteiro de quem já foi"), map+timeline sync ("o mapa e a lista são a mesma viagem") — alternating text/specimen layout, each band showing a real product fragment, no mascots or scene illustration.
- **FAQ accordion** (shadcn `accordion`): fork, pricing/free, private itineraries + invite links, how AI generation works, offline/PWA. Content in both locales.
- **Destination chips + quiet social proof:** popular-destination chips linking to `/explore` pre-filtered searches (server-derived from real data), and a single caption-level line of community numbers (X roteiros publicados · Y destinos) — deliberately not the boxed hero-metric template.

Auth:
- Brand panel gains **the product, live**: a compact specimen (timeline fragment or mini card) floating over the panel (the BonSanté card move, in our cream-card language — no glassmorphism), plus a caption line of real community numbers (shared server fn with the landing's social proof).
- **LocaleSwitcher on the auth pages** (BonSanté) — today the switcher hides with the header, so language can't be changed from `/login`; AuthShell gets it in the form column's top edge.
- **Google social login** (Google only; Apple documented as future) via Better Auth's Google provider (consult Better Auth docs first per CLAUDE.md policy): "Continuar com Google" under an "ou continue com" divider on both forms, `GOOGLE_CLIENT_ID/SECRET` env (documented in DEPLOY.md), button hidden cleanly when unconfigured.
- **Password reset, full flow**: Better Auth forget/reset-password with **Resend** as the email provider (`RESEND_API_KEY`, sender documented in DEPLOY.md); "Esqueci a senha" link on login → email → reset page; link only renders when the provider is configured. Optional "remember me" checkbox mapped to Better Auth's rememberMe.
- Form polish per the mobile reference: labeled fields (not placeholder-only), sign-up hand-off line, focus order, motion timing — no structural change beyond the above.

Server: one `getCommunityStats` fn (counts + top destinations, cached-friendly) reused by landing chips, social proof, and the auth panel.

Acceptance: hero collage responsive without overflow at 390/768/1440 in both themes; specimens are real components (i18n follows locale); FAQ keyboard-navigable; Google button works locally with env set and disappears cleanly without it; AA re-verified on any new pair.

### Phase 1 — Explore as map-workspace + mobile filter sheet
*Branch: `feat/explore-map-workspace`*

Desktop (`lg+`): full-viewport map canvas under the header; a floating workspace panel (fixed width ~420px, `shadow-elevated`, internally scrollable) carries search, filter chips, and the result cards. All published routes with geocoded stops draw on the canvas (reuse `LandingMap`'s source/layer approach, promoted to a shared `RoutesCanvas` component); hovering a card highlights its route (line width/opacity state) and vice-versa; clicking opens the itinerary. Results without geocodes still list in the panel — the map is the stage, never a gate. Panel collapse control (OrbitTrip's `|←`) gives the map the whole stage.

Mobile: list-first (current grid) with a floating "Mapa" toggle chip swapping to the canvas; filters move to a bottom sheet (shadcn `sheet`): duration chips, rating, tags, sorted by the existing search params (nuqs) — closing CTA "Mostrar N roteiros" with live count.

Server: extend the explore query to return route polylines (slug, title, points) for the current filter set (same shape as `getLandingHighlights().mapRoutes`, but filter-aware + paginated cap).

Acceptance: hover sync both directions; URL params unchanged (shareable filters keep working); no layout shift on panel collapse; map never blocks list usability offline.

### Phase 2 — Detail: day tabs + timed timeline
*Branch: `feat/detail-day-tabs-times`*

Schema: `stop.start_time` + migration; editor `StopForm` gains an optional time input; AI draft schema/prompt emit plausible times.

Detail page: sticky day-tab row (chips, `Dia 1 · Rio`) above the timeline; tabs scroll-spy/anchor to each day (content stays one continuous timeline — no content swapping, so deep links and reading flow survive); each stop row shows time (tabular-nums) and the category icon inside the meta row. Map pins/popups pick up the time. The timeline keeps continuous trip-wide numbering.

Acceptance: long trips (10+ days) navigable in one tap; stops without time render cleanly (no dangling separators); pt-BR/en verified.

### Phase 3 — Editor map-first + budget
*Branch: `feat/editor-map-budget`*

Editor (desktop `md+`): split workspace — editing panel beside a live map of the draft. Place search (Nominatim, same 1 req/s etiquette as `geocodeStopsBestEffort`) via a command-style input; picking a result fills name/lat/lng/placeLabel; clicking an existing pin scrolls to its stop; stop reorder stays in the list (drag on map is out of scope). Mobile keeps the current form flow (map preview collapsible) — no map-editing on touch in this phase.

Budget: `itinerary.currency` + migration; cost input already exists per stop — add currency selector in itinerary settings, day subtotals + trip total in editor and detail (derived), cost badge on cards, budget range + currency filter in explore's sheet/panel.

Acceptance: creating a 2-day trip end-to-end without leaving the editor (search → pick → stop appears on map); totals update live; geocode failures degrade to manual fields.

### Phase 4 — AI assistant in the editor + /new
*Branch: `feat/ai-assistant-chat`*

A lazy-loaded chat panel docked in the editor (desktop: right column over the map edge; mobile: full-height sheet). Two capabilities via Vercel AI SDK tool-calling (`streamText` + tools): **create** (same contract as today's `generateItineraryDraftImpl`) and **revise** (structured patch ops — add/remove/update day or stop — validated by Zod, applied transactionally, previewed as a diff card before "Aplicar"). `/new`'s AI mode becomes an entry point that opens the editor with the chat open. Quota evolves: `ai_generation` rows become per *applied* generation/revision (browsing the chat is free; applying counts), still 5/day initially. All provider calls stay server-side; conversation state is client-held (no chat persistence in v1).

Acceptance: "cria 3 dias em Salvador" → draft appears; "troca o dia 2 por praias" → diff preview → apply updates editor + map; quota exhaustion and provider failure surface as friendly states; mocked-provider tests for patch validation and quota.

## Cross-cutting

- i18n: every new string in `messages/{pt-BR,en}.json`; paraglide recompile in each phase.
- Docs: DESIGN.md + `.interface-design/system.md` updated per phase (new patterns: workspace panel, day tabs, chat panel).
- Tests: server logic (route payloads, totals, patch ops, quota) with the existing DB harness; component tests where forms change.
- Risks: MapLibre perf with many routes (cap + simplify polylines); Nominatim rate limits (queue + cache); AI patch safety (Zod-validated ops only, transactional apply); scope creep in Phase 1 panel (keep filters identical to today's, only re-housed).

## Out of scope (documented, not planned)

Discovery assistant in `/explore`; cross-currency conversion; drag-to-reorder on the map; chat persistence; multi-traveler/dates context bar; PWA offline maps.
