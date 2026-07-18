# Roteiros — interface-design system memory

Source of truth shared with `PRODUCT.md` / `DESIGN.md` (impeccable skill). Read this before touching any UI; keep values in sync if either file changes.

## Direction and feel

**"The Shared Logbook."** Elegant, calm, editorial — a well-kept travel journal passed from traveler to traveler (fork, annotate, carry forward), not a booking dashboard. Warm paper tones, one deliberate terracotta accent, a serif hand reserved for content (itinerary/day titles) over a quiet sans that runs the interface. Mobile is the primary surface and must feel like a native app: bottom tab bar, safe-area insets, ≥44px targets, app-like route transitions. PWA standalone is planned.

Explicitly rejected: Inter-for-everything, purple→blue gradients, cards nested in cards, gray text on colored backgrounds, rounded-square icon tiles above headings, generic SaaS-dashboard chrome, mobile-as-afterthought.

## Depth strategy and spacing

- **Depth strategy: shadow-based elevation, borders reserved for dividers/inputs/rows only.** Never combine a border and a shadow on the same card (the "ghost card" tell). Dark mode collapses all shadow levels to a single `0 0 0 1px rgba(255,255,255,0.08)` ring.
- **Spacing base unit: 4px.** Scale: `xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 48`. Standard component padding 16px; section gaps 24px; major area gaps 32-48px desktop, tighter (12-16px) on mobile. Density target is airy-calm, not workbench-tight — this is a reading/planning product, not a data tool.
- **Radius scale:** `sm 6px` (inputs) · `md 10px` (buttons) · `lg 14px` (cards) · `xl 20px` (modals/sheets) · `full` (tags, chips, floating mobile CTA). Never exceed 20px except full-pill. Nested elements stay concentric (`outerRadius = innerRadius + padding`) — e.g. a card cover photo's radius is the card radius minus its padding.

## Hierarchy decisions

- **Type scale ratio:** ~1.2, fixed rem (not fluid/clamped) for interface type — product register, consistent DPI. Base body 15px (`0.9375rem`).
- **Steps:** caption 12 · label 13 · body 15 · title 17 · headline 22 · display 32 (up to 40 on the itinerary hero only).
- **Density:** one sans family (Karla) carries essentially the whole interface; the serif (Fraunces) appears only on content titles — see the Editorial Title Rule below. This keeps product-register legibility while still delivering the editorial feel the brief asked for.
- **Focal pattern:** on any screen, the itinerary content (title, cover photo, day/stop timeline) is the focal element — sized, weighted, and given whitespace to win over nav, filters, and metadata, which stay in Label/Caption tiers.

## Color tokens (OKLCH, canonical — matches this project's existing shadcn OKLCH doctrine)

| Token | Value | Role |
|---|---|---|
| `--ink` | `oklch(0.24 0.02 45)` | primary text |
| `--ink-soft` | `oklch(0.45 0.02 45)` | secondary/meta text |
| `--paper` | `oklch(0.985 0.004 60)` | page background |
| `--surface` | `oklch(0.97 0.006 55)` | cards, top nav, bottom tab bar |
| `--surface-sunken` | `oklch(0.94 0.008 55)` | inputs, search, tag pills (always darker than surroundings) |
| `--terracotta` | `oklch(0.58 0.15 38)` | the one accent: primary actions, selection, focus rings, links |
| `--terracotta-deep` | `oklch(0.49 0.16 35)` | accent hover/active |
| `--terracotta-soft` | `oklch(0.93 0.04 45)` | tinted accent backgrounds (selected chip fill) |
| `--rating-gold` | `oklch(0.78 0.15 85)` | star ratings only — semantic exception, never on buttons/nav |
| `--line` / `--line-strong` | `oklch(0.24 0.02 45 / 0.12)` / `/ 0.2` | dividers, input borders, table/list rows |
| `--success` | `oklch(0.6 0.12 145)` | semantic |
| `--warning` | `oklch(0.75 0.14 80)` | semantic |
| `--destructive` | `oklch(0.55 0.2 15)` | semantic |

Dark mode: same hierarchy, inverted lightness, one hue kept per token — base `oklch(0.18 0.012 45)`, surface `oklch(0.22 0.014 45)`, surface-sunken `oklch(0.16 0.012 45)`, text `oklch(0.96 0.006 60)` / `oklch(0.72 0.012 55)`, accent desaturated slightly to `oklch(0.68 0.13 40)`.

**Named rules:** *One Warm Voice* (terracotta is the only saturated brand color; rating-gold is a scoped semantic exception) · *No-Cream-Default* (paper is true off-white at chroma 0.004, not a saturated sand/parchment tone — warmth comes from the accent and Fraunces, not the body background).

## Typography

- **Display:** Fraunces (variable optical-size axis), weight 500, `letter-spacing -0.02em`, `line-height 1.1`. Package: `@fontsource-variable/fraunces`.
- **Body/UI:** Karla, weights 400/500/600. Package: `@fontsource/karla`.
- **No third/mono family** — dynamic numbers (day counts, ratings, prices) use Karla with `font-variant-numeric: tabular-nums`.
- **The Editorial Title Rule:** Fraunces is reserved for content titles (itinerary name, day headers) only. Every piece of interface chrome — nav, buttons, labels, badges, table/list data — stays in Karla. This is the one deliberate display-font exception in an otherwise single-family product UI.
- **The 70ch Rule:** long-form prose (stop notes, comments, bios) wraps at ≤70ch regardless of viewport.
- Fonts are **not installed yet** — this is design-context only, no restyle performed. See `DESIGN.md` §3 for the full hierarchy table.

## Key component patterns

- **Button primary** — 40px h (44px on mobile floating CTA) · 10px/20px pad · 10px radius · terracotta bg / paper text · `scale(0.97)` on active · terracotta-deep on hover.
- **Itinerary card** — 14px radius · no border · Resting shadow → Lifted shadow on hover · cover photo radius concentric with card · title in Fraunces 17px/600, destination in Karla 13px ink-soft.
- **Input** — 40px h · surface-sunken bg (darker than surroundings) · 1px line border · 6px radius · terracotta border + 20%-opacity ring on focus.
- **Tag/chip** — full radius · surface-sunken bg / ink-soft text at rest · terracotta-soft bg / terracotta-deep text when selected.
- **Bottom tab bar (mobile nav)** — fixed, surface bg, `env(safe-area-inset-bottom)` padding, 56px+ height, icon+11px label per tab, active tab in terracotta with filled icon, all targets ≥44×44px.
- **Day/Stop timeline (signature component)** — vertical `line`-colored spine; day markers in Karla 600/17px break the spine; stops are quiet rows (thumbnail + Title-weight name + Body-weight note), never boxed as nested cards. This is the one structural element unique to Roteiros.

## Motion

- 150-250ms, `cubic-bezier(0.23, 1, 0.32, 1)` (ease-out-expo) for entrances/reveals, `cubic-bezier(0.77, 0, 0.175, 1)` for on-screen movement.
- Mobile route push/pop: 260ms slide+fade. Bottom-tab switches: crossfade only (tabs are peers, not a stack).
- No choreographed page-load sequences — product loads into a task.
- `prefers-reduced-motion`: every animation has a crossfade/instant fallback.

## Visual direction notes

- Font pairing chosen for real self-hostable availability (proxy blocks Google Fonts CDN): `@fontsource-variable/fraunces` (display) + `@fontsource/karla` (body/UI), both verified present on the npm registry (`fraunces@5.2.9`, `karla@5.2.8` at time of writing). Karla was picked over the project's previous Manrope pairing specifically to avoid the extremely common "Fraunces + Manrope" editorial-SaaS template combo while keeping the same warm-humanist contrast axis.
- The project's current `src/styles.css` already contains an earlier, unwired attempt at a coastal teal/green theme (`--sea-ink`, `--lagoon`, `--palm`...) loading Fraunces/Manrope from the Google Fonts CDN — which the environment's proxy blocks, so those fonts never actually load. That earlier direction is superseded by this system; it was not "committed" in the sense of a settled, working brand (the user explicitly asked to kill the current raw/generic look), so this document defines the new target rather than documenting the old one. No code was changed as part of this task.

## Consistency checks

Hold every future UI change to: spacing on the 4px grid, shadow-only elevation (no border+shadow combo), colors only from the table above, Fraunces only on content titles, and the component measurements listed here reused rather than reinvented.
