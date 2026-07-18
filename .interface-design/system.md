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

| Token                      | Value                                  | Role                                                           |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `--ink`                    | `oklch(0.24 0.02 45)`                  | primary text                                                   |
| `--ink-soft`               | `oklch(0.45 0.02 45)`                  | secondary/meta text                                            |
| `--paper`                  | `oklch(0.985 0.004 60)`                | page background                                                |
| `--surface`                | `oklch(0.97 0.006 55)`                 | cards, top nav, bottom tab bar                                 |
| `--surface-sunken`         | `oklch(0.94 0.008 55)`                 | inputs, search, tag pills (always darker than surroundings)    |
| `--terracotta`             | `oklch(0.58 0.15 38)`                  | the one accent: primary actions, selection, focus rings, links |
| `--terracotta-deep`        | `oklch(0.49 0.16 35)`                  | accent hover/active                                            |
| `--terracotta-soft`        | `oklch(0.93 0.04 45)`                  | tinted accent backgrounds (selected chip fill)                 |
| `--rating-gold`            | `oklch(0.78 0.15 85)`                  | star ratings only — semantic exception, never on buttons/nav   |
| `--line` / `--line-strong` | `oklch(0.24 0.02 45 / 0.12)` / `/ 0.2` | dividers, input borders, table/list rows                       |
| `--success`                | `oklch(0.6 0.12 145)`                  | semantic                                                       |
| `--warning`                | `oklch(0.75 0.14 80)`                  | semantic                                                       |
| `--destructive`            | `oklch(0.55 0.2 15)`                   | semantic                                                       |

Dark mode: same hierarchy, inverted lightness, one hue kept per token — base `oklch(0.18 0.012 45)`, surface `oklch(0.22 0.014 45)`, surface-sunken `oklch(0.16 0.012 45)`, text `oklch(0.96 0.006 60)` / `oklch(0.72 0.012 55)`, accent desaturated slightly to `oklch(0.68 0.13 40)`.

**Named rules:** _One Warm Voice_ (terracotta is the only saturated brand color; rating-gold is a scoped semantic exception) · _No-Cream-Default_ (paper is true off-white at chroma 0.004, not a saturated sand/parchment tone — warmth comes from the accent and Fraunces, not the body background).

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

## Implementation log — UI overhaul part 1 (foundation + shell)

Tokens, fonts, and the app shell (`AppHeader` / `BottomNav` / router-level
fallbacks) were wired up in `src/styles.css`, `src/components/AppHeader.tsx`,
`src/components/navigation/`, `src/router.tsx`, and `src/routes/__root.tsx`.
New decisions made during that pass, not already covered above:

- **Font delivery**: `@fontsource-variable/fraunces` (the `opsz.css` axis
  file only — optical-size axis, weight 500, `font-optical-sizing: auto`)
  and `@fontsource/karla` (`latin-400/500/600.css` only — the three weights
  DESIGN.md's ramp actually uses). Imported via plain `@import` in
  `styles.css`, resolved by Lightning CSS the same way the pre-existing
  `@import 'tailwindcss'` / `@import 'tw-animate-css'` bare specifiers are —
  no JS-side font import needed, and no CDN request.
- **shadcn/ui slot aliasing**: `--background/--foreground/--primary/...`
  (the vocabulary every existing `bg-*`/`text-*` utility across the app
  already uses) are now aliases onto the DESIGN tokens rather than
  hand-picked separately: `--accent` → `surface-sunken` (the ghost/outline
  hover tint DESIGN.md's Buttons section describes), `--destructive-foreground`
  → `paper` (the Do's/Don'ts rule: paper text on saturated fills, never
  ink-soft/gray). This means every shadcn primitive picked up the new
  theme automatically without a component-by-component restyle (that's
  part 2's job); only the raw color values changed here.
- **Radius scale**: `--radius-sm/md/lg/xl` in `@theme inline` are literal
  6/10/14/20px (DESIGN.md's `rounded.*` scale exactly), not calc-derived
  from a single base as shadcn's default template does — the base
  `--radius: 10px` custom property is kept only because `ui/sonner.tsx`
  reads it directly as `--border-radius`.
- **Shadow vocabulary as Tailwind utilities**: `--shadow-resting/-lifted/
-elevated` in `@theme inline` generate `shadow-resting` / `shadow-lifted`
  / `shadow-elevated` classes from DESIGN.md §4's literal box-shadow
  values (ink-tinted, not black). The raw values live in `--shadow-*-value`
  custom properties in `:root`/`.dark` (the `-value` suffix avoids a
  circular reference against the theme key of the same name); `.dark`
  collapses all three to the single light hairline ring per the Quiet
  Lift Rule.
- **Dark-mode tokens beyond the ones system.md already specified**
  (base/surface/surface-sunken/text/text-soft/accent): derived, same
  hue-per-token discipline — `terracotta-deep` `oklch(0.6 0.14 38)`,
  `terracotta-soft` `oklch(0.32 0.06 40)`, `rating-gold` `oklch(0.8 0.14 85)`,
  `line`/`line-strong` at `oklch(0.96 0.006 60 / 0.12)` and `/ 0.2` (light
  ink at low opacity, mirroring the light-mode pattern), `success`
  `oklch(0.65 0.13 145)`, `warning` `oklch(0.78 0.14 80)`, `destructive`
  `oklch(0.62 0.2 15)` (all nudged lighter than their light-mode values for
  dark-surface legibility).
- **App shell decomposition**: `UserMenu` (`src/components/navigation/
UserMenu.tsx`) holds the session-dependent account area (avatar dropdown
  or login link) and takes a `variant: 'header' | 'tab'` prop; both
  `AppHeader` and `BottomNav` render it independently (each calls
  `authClient.useSession()` itself) rather than threading session state
  through props. `AppHeader` simplifies on mobile (`<md`): primary nav
  links and the account area hide (`hidden md:flex` / `hidden md:block`)
  because `BottomNav` owns those on small screens — only the wordmark and
  `LocaleSwitcher` stay in the mobile header, per DESIGN.md's "header
  simplified on mobile" note.
- **`BottomNav`'s Profile tab has no dedicated route to link to** (no
  `/profile` page exists in this app). It reuses the same account
  `DropdownMenu` as the desktop `UserMenu` (opening upward, `side="top"`)
  when signed in, and is a plain `Link` to `/login` when signed out — this
  keeps the "4 fixed tabs" shape from DESIGN.md's Navigation section
  without inventing a new page (out of scope: zero behavior/route changes).
  `Home`/`My itineraries`/`New` are plain links to the existing `/`, `/my`,
  `/new` routes; `/my` and `/new` already redirect anonymous visitors to
  `/login` in their own `beforeLoad` guards, so `BottomNav` doesn't
  duplicate that check.
- **Router-level fallbacks** (`src/components/RouteFallbacks.tsx`,
  wired via `router.tsx`'s `defaultPendingComponent` /
  `defaultErrorComponent` / `defaultNotFoundComponent`): a centered
  `LoaderCircleIcon` spinner (`role="status"`, sr-only label) for pending
  states, and a centered title/description/action pair (Fraunces title,
  Karla body, `reset()`-driven retry or a `Link to="/"`) for the error and
  not-found fallbacks. Existing route-level `notFoundComponent`s
  (itinerary, editor) still take precedence — the root fallback only
  catches genuinely unmatched URLs.
- **PWA meta colors**: `theme-color` (light `#f8f4f1`, dark `#201915`) and
  `manifest.json`'s `theme_color`/`background_color` are sRGB conversions
  of the `surface`/`paper` OKLCH tokens (`theme-color`'s `oklch()` support
  isn't universal yet, so hex is the safe encoding here). Manifest icons
  reuse the existing `logo192.png`/`logo512.png` assets as-is — no new art
  was generated as part of this pass.

## Implementation log — UI overhaul part 2 (page restyles + nuqs + decomposition)

Restyled every page (`/`, `/itineraries/$slug`, `/login`, `/signup`, `/my`,
`/new`, `/my/$id/edit`) to the tokens above, migrated the home route's URL
state to nuqs, and decomposed the itinerary view. New decisions made during
this pass, not already covered above:

- **Type-scale utilities wired into Tailwind**: `--text-display/-headline/
-title/-body/-label/-caption` (with paired `--text-*--line-height`) added
  to `@theme inline` in `src/styles.css`, generating `text-display` …
  `text-caption` utilities at DESIGN.md §3's exact rem/line-height values.
  `text-display` sets size/line-height only — pair it with `.font-display`
  (already defined in part 1, unlayered so it always wins the family/
  weight/letter-spacing/tabular-nums cascade over any Tailwind utility
  regardless of class order) for the Fraunces treatment.
- **Ghost-card kill switch**: `ui/card.tsx` dropped its `border` and moved
  `shadow-sm` → `shadow-resting` (14px radius, was 20px/`rounded-xl`) —
  this alone re-themes every card in the app (itinerary cards, editor
  cards, auth cards) per the Quiet Lift Rule. Same border-drop + shadow-
  vocabulary swap applied to `ui/dialog.tsx` (→ `shadow-elevated`,
  `rounded-xl`), and `ui/popover.tsx` / `ui/dropdown-menu.tsx` /
  `ui/select.tsx` (→ `shadow-lifted`, the "open dropdown/menu" step).
- **`Badge`'s new `tag` variant**: `bg-muted text-muted-foreground` (i.e.
  surface-sunken/ink-soft) — DESIGN.md's actual Chips/Tags spec, as
  opposed to the generic `secondary` variant status badges (draft/
  published) still use. Itinerary tags (cards, home filter, editor tag
  input) now use `variant="tag"`; status badges are unchanged.
- **Rating color**: `RatingStars` / `ItineraryCard` switched their star
  fill from Tailwind's stock `amber-500` to the `--rating-gold` token
  (DESIGN.md's scoped semantic exception — ratings only, never buttons/nav).
- **Editorial Title Rule, applied**: `.font-display` now actually appears
  on the itinerary's own title (`ItineraryHero`, `ItineraryCard`) _and_ on
  in-page day headings (`DayTimeline`'s "Day N" markers) — the task brief
  for this pass explicitly scoped Fraunces to "itinerary titles, day
  headings," a hair wider than DESIGN.md §3's literal "itinerary name and
  nothing else." Every other heading (page H1s on `/my`, card titles in
  the editor, section headers) stays Karla at the `text-headline` step.
- **nuqs adopted for the home route's URL state** (`pnpm add nuqs`,
  `nuqs/adapters/tanstack-router`). `NuqsAdapter` wraps `children` in
  `src/routes/__root.tsx`'s `RootDocument` (must live inside the
  router-provided tree; `router.tsx` itself can't host it). `q`/`tags`/
  `duration`/`sort`/`page` in `src/routes/index.tsx` moved from hand-rolled
  `Route.useSearch()`/`Route.useNavigate()` to `useQueryStates` — same
  debounced-search-box, page-reset-on-filter-change, and push-vs-replace
  history behavior as before (nuqs's own history default is `replace`, so
  every call site now passes `history` explicitly — `push` at the hook
  level, `replace` only for the debounced search-box effect).
  - **Reconciling nuqs with the route's `validateSearch`**: the loader
    keeps its Zod schema (`homeSearchSchema`) as the SSR/`ensureQueryData`
    contract — nuqs and `Route.useSearch()` both read the same underlying
    router search state, so they can't drift. The one wrinkle: TanStack
    Router's default search serializer JSON-encodes non-primitive values
    (`tags=%5B%22a%22%5D`), which doesn't round-trip through nuqs's own
    comma-joined array format (`tags=a,b`) — a write from nuqs would come
    back from the router as a _string_, not an array, breaking a
    `z.array()` schema. Fix: `tags` is a plain comma-joined `z.string()`
    at the route/schema level (a wire-format detail, not a data-model
    change — `searchItineraries` itself still takes `tags: string[]`);
    `parseTagsParam` (loader side) and nuqs's `parseAsArrayOf` (component
    side) both split on the same separator, so the two stay equivalent.
    This is the idiomatic reconciliation nuqs's TanStack Router adapter
    expects for non-primitive search params.
- **Itinerary view decomposition** (`src/components/itinerary/`):
  `ItineraryViewProvider`/`useItineraryView` (React context) carries
  viewer-scoped fields — `itineraryId`, `slug`, `inviteToken`,
  `redirectTarget`, `session`, `canRate` — that would otherwise have to
  tunnel through the page's new section components (`ItineraryHero`,
  `EngagementBar`, `DayTimeline`) down to the actual engagement widgets
  (`RatingStars`, `FavoriteButton`, `ForkButton`, `Comments`). Those four
  leaf components keep their pre-existing explicit-prop APIs unchanged
  (they're unit-tested standalone, outside any provider — see
  `RatingStars.test.tsx`); only `EngagementBar` (new) and `Comments`
  (no dedicated test) consume the context directly. `ItineraryView` itself
  now only threads the itinerary's own content (`data`, `data.days`) as
  props — never viewer/session state — into its section components.
- **`DayTimeline`** (`src/components/itinerary/DayTimeline.tsx`) is the
  first real implementation of DESIGN.md §5's signature "logbook spine":
  a `border-l border-line` rule with each day as an absolutely-positioned
  terracotta dot breaking it, stops listed beneath via the pre-existing
  `StopList` (already a quiet-row list, no nested cards).
- **Shared `Pagination`** (`src/components/Pagination.tsx`) and
  **`ItineraryGridSkeleton`** (`src/components/ItineraryCardSkeleton.tsx`)
  replace the near-duplicate prev/next pagers and add a branded,
  grid-shaped Suspense fallback — both `/` and `/my` (mine + favorites,
  each its own `<Suspense>` boundary around its `useSuspenseQuery`) use
  them, so a tab switch or slow filter change shows itinerary-card-shaped
  skeletons instead of a full-page spinner or stale content.
- **Loading polish beyond the grids**: `ItineraryMap`'s Suspense fallback
  is now the `Skeleton` primitive (was a raw `animate-pulse` div);
  `Comments` shows two skeleton comment rows while its initial
  `useInfiniteQuery` fetch is in flight (`commentsQuery.isLoading`,
  distinct from the already-handled empty state) instead of rendering
  nothing.

## Implementation log — mobile shell polish (BottomNav alignment + PWA)

- **`BottomNav` box model, made explicit**: the bar's content row is a fixed
  `4rem` (64px) — `h-[calc(4rem+env(safe-area-inset-bottom))]` plus a
  matching `pb-[env(safe-area-inset-bottom)]` (border-box means the padding
  is carved out of that `h-*`, not added on top, so the visible content
  band stays exactly 64px on every device). `items-stretch` on the `<nav>`
  stretches all four tab items to that same 64px slot; each item then
  self-centers its icon+label with `items-center justify-center`. This
  replaced the earlier ad hoc padding-only bar, where the Home/My tabs
  (`min-h-11`), the "+" FAB (`-translate-y-2` with no baseline reference),
  and the Profile avatar (unconstrained skeleton/button sizing) each
  computed their own height and landed on three different optical
  baselines — a production screenshot report.
- **Icon box, unified at 24px**: `HomeIcon` / `BookOpenIcon` / signed-out
  `UserIcon` all render at `size-6` (24px), matching `Avatar size="sm"`
  (also `size-6` = 24px) so the Profile tab's avatar sits in the same
  icon-box footprint as every icon-based tab, whether signed in or out.
  (Previously the icon tabs were `size-5`/20px while the avatar was
  24px — a second source of baseline drift.)
- **FAB decision: no label, floating half above the bar.** Considered
  giving the "+" FAB an 11px label to baseline-match the other three tabs,
  but a labeled circle crowds the 64px row and reads as a fifth line of
  text competing with the bar's actual tab labels. Went with the standard
  native pattern instead: the FAB's slot centers like every other tab
  (inherits the same 64px stretch), then `-translate-y-8` — exactly half
  of 64px — lifts the circle's _center_ to sit on the bar's top edge, so
  the circle floats half outside the chrome and half inside it,
  independent of the circle's own diameter (currently `size-12`/48px).
  This is what DESIGN.md's "elevated pill button" phrase was gesturing at;
  this is the concrete resolution.
- **PWA icons**: `logo512.png` is the source for regenerated `logo192.png`/
  `logo512.png` (standard, `purpose: "any"`), new `maskable-192.png`/
  `maskable-512.png` (`purpose: "maskable"`, generated with a safe-zone
  padding so the source art isn't clipped inside the OS's maskable circle),
  and `apple-touch-icon.png` (180px, opaque background — iOS ignores alpha
  and will render transparency as black otherwise). All four are wired into
  `public/manifest.json`; `apple-touch-icon.png` is also linked directly in
  `<head>` since iOS Safari doesn't read the web manifest's icon list for
  its home-screen icon.
- **PWA service worker: hand-written, not `vite-plugin-pwa`.** Tried
  `vite-plugin-pwa` (`generateSW`, `registerType: 'autoUpdate'`) first, per
  the task brief. Confirmed by direct build testing that its `closeBundle`
  hook — the step that actually writes `sw.js` — never fires for either of
  TanStack Start's Vite Environment API build passes (`client`/`ssr`):
  `pnpm build` and `pnpm build:vercel` both complete successfully but
  silently produce zero service-worker output. Rather than debug a
  plugin/Environment-API integration issue blind (no real browser
  available in this environment to verify a fix), fell back to the
  documented alternative: a small hand-written `public/sw.js` (plain
  static file, cache-first for the never-hashed manifest+icon set only,
  network-passthrough for everything else — SSR pages, hashed JS/CSS, API
  calls — since serving stale HTML for a dynamic per-request app would be
  wrong), registered manually from `src/components/PwaRegister.tsx` via a
  client-only `useEffect` mounted in `RootDocument`. `self.skipWaiting()` +
  `self.clients.claim()` in the SW's own install/activate handlers stand
  in for `vite-plugin-pwa`'s `registerType: 'autoUpdate'`. Net effect for
  the user-reported issue ("tem que sair a URL, funcionar como PWA"):
  installability (manifest + icon set + a registered, controlling SW) is
  delivered; a full offline-first cache of app pages/scripts is not — that
  would need a build-time-integrated plugin to enumerate hashed asset
  names safely, which is exactly the piece that didn't work here.

## Implementation log — mobile app-grade UX redesign (Home/Detail/Editor)

Redesigned the three primary mobile (`<md`) screens to feel like a real app
(Uber Eats/Glovo/WhatsApp references) rather than a stacked web form, per
direct user feedback. Desktop (`md+`) keeps its previous layout everywhere
except where noted. New decisions, not already covered above:

- **`Drawer` vendored** (`src/components/ui/drawer.tsx`, `pnpm add vaul`) —
  shadcn's registry component, `@/`→`#/`, restyled to this project's
  elevation/radius vocabulary (`shadow-elevated`, `rounded-xl` — the
  "sheets" step of the radius scale — instead of the stock template's
  `shadow-sm`/`rounded-lg`), `bg-ink/50` overlay instead of `bg-black/50`,
  and a `pb-[env(safe-area-inset-bottom)]` on the bottom-direction variant
  so sheet content clears the home-indicator area.
- **`useIsMobile` hook** (`src/hooks/use-is-mobile.ts`) — `matchMedia`
  against Tailwind's `md` breakpoint (767px), `false` on the server and
  first client render, corrected in a `useEffect`. Used only where a
  control needs two *structurally different* components for the same job
  (Dialog vs Drawer, inline `Comments` vs a sheet-triggered one) — CSS
  `md:hidden`/`hidden md:flex` toggles (already the project's convention
  from `AppHeader`/`BottomNav`) are used everywhere a plain visibility
  swap is enough, since that's SSR-safe with zero hydration risk. This is
  also why the home page's filter chip row/sheet trigger is *always*
  present in SSR markup (verified by grepping the rendered HTML) while the
  editor's stop-form sheet and the detail page's comments-sheet trigger
  render their **desktop** branch (Dialog / inline `Comments`) during SSR
  and flip after hydration — a deliberate, documented tradeoff, not an
  oversight.
- **`ResponsiveSheet`** (`src/components/ResponsiveSheet.tsx`) — the
  Dialog/Drawer switch as one reusable component (title + children,
  fully controlled `open`/`onOpenChange`, no `Trigger` subcomponent since
  the two primitives don't share one). Used by `DayEditor`'s stop
  add/edit form.
- **`CoverPlaceholder`** (`src/components/CoverPlaceholder.tsx`) — the
  branded "no cover photo" treatment (terracotta-tinted 14px diagonal
  hatch, `terracotta-soft` base, a centered `CompassIcon` at 40% opacity)
  extracted so `ItineraryCard` (discovery grid) and `ItineraryHero`
  (mobile immersive detail hero, both cover-present and cover-absent
  paths) render the exact same "no cover" mark rather than two different
  gray-void fallbacks — PRODUCT.md's anti-references flag a flat gray box
  as a native-web-afterthought tell.
- **Home (`/`)**: mobile gets a sticky compact top (`sticky top-0`, under
  `AppHeader`'s wordmark bar once that scrolls past) — a full-height
  rounded search field (`rounded-full`, `surface-sunken`) plus a
  horizontally scrollable chip row (`.no-scrollbar` utility, new in
  `styles.css`) of: a "Filtros" chip (opens the filters `Drawer`, shows a
  terracotta dot when any filter is active), the four duration-bucket
  chips as direct one-tap toggles, and the active tag chips with inline
  remove. The "Filtros" sheet holds the *full* control set per the task
  brief — tag input, a duration `Select`, and sort as the existing `Tabs`
  segmented control reused verbatim (not a new component) — even though
  the duration bucket chips already offer a quick path outside the sheet;
  both are intentional, not a duplication bug. Desktop keeps the original
  stacked hero + inline `FieldGroup` filter form byte-for-byte, gated
  behind `hidden md:flex` (mobile's markup sits behind `md:hidden`
  instead) — both blocks share the *same* `addTag`/`removeTag`/`setQuery`
  closures, so there's exactly one source of truth for filter state
  regardless of which markup is visible. One id-collision pitfall worth
  recording: `hidden md:flex` still renders to the DOM (just
  `display:none`), so anything appearing in *both* the always-visible
  mobile sheet and the desktop-only form (the tags field) needs a
  per-call-site-unique `id`/`htmlFor` pair (`renderTagsField(idSuffix)`)
  — a literal duplicate `id` would otherwise exist in the DOM simultaneously.
  **`ItineraryCard`** was rebuilt content-first (Uber Eats/Glovo card
  shape): a full-bleed `aspect-[4/3]` cover with day-count/rating as
  compact floating badges (`bg-paper/90 backdrop-blur-sm`, numbers only —
  the full "N dias"/"N avaliações" context moved to each badge's
  `aria-label` rather than dropped, since the previous inline text is no
  longer visually present) over the image, title/destination as a tight
  text block below it (the brief's explicit alternative to a gradient
  scrim — chosen for predictable contrast against arbitrary user photos).
  The discovery grid itself moved to 2 columns even on the smallest
  phones (`grid-cols-2` → `lg:grid-cols-3 xl:grid-cols-4`), matching the
  reference apps' feed density instead of one full-width card per row.
- **Detail (`/itineraries/$slug`)**: `ItineraryHero` now renders two
  structurally different `<header>` blocks (`md:hidden` / `hidden
  md:flex`), not one reflowed layout — the mobile version bleeds the cover
  edge-to-edge via a negative margin that exactly cancels the page
  container's own `p-4`/`sm:p-6` (`-mx-4 -mt-4 sm:-mx-6 sm:-mt-6`, the
  same trick the sticky engagement bar below reuses), floats a translucent
  circular back button (`bg-ink/45 backdrop-blur-sm`, calls
  `router.history.back()` — deliberately *not* a `Link` to a hardcoded
  route, so it returns wherever the visitor actually came from, matching
  native back-button semantics) over the cover, and overlaps a
  `shadow-elevated` title card `-mt-8` onto the cover's bottom edge. The
  engagement bar (favorite/rate/fork) is wrapped in a `sticky top-0 z-20`
  container (same edge-to-edge negative-margin trick, `md:static` to fully
  revert on desktop) so it pins under the header once the hero scrolls
  past — DESIGN.md's "sticky headers for context" mobile pattern. Comments
  render inline on desktop exactly as before; on mobile they move into a
  `Drawer` behind a summary row button showing a live count
  (`m.view_comments_open({count})`) — the count comes from re-subscribing
  to the *same* `commentsQueryOptions` query key the route loader already
  `ensureInfiniteQueryData`'d, so it's zero extra network cost, not a new
  data dependency. `Comments` gained a `showTitle` prop (default `true`)
  so the sheet variant doesn't duplicate `DrawerTitle` with `Comments`'
  own `<h2>` — same text rendered twice was the alternative, rejected per
  DESIGN.md/distill's "no redundant copy" rule.
- **Editor (`/my/$id/edit`)**: route order changed to Metadata → Days →
  Publish → Members (was Metadata → Publish → Members → Days) on *both*
  breakpoints — the itinerary's actual content (days/stops) now leads,
  publish/member settings trail as secondary, occasional actions,
  matching "content leads, chrome recedes." `DayEditor`'s stop add/edit
  form moved from a bare `Dialog` to `ResponsiveSheet` (Drawer on mobile).
  Each day's `Card` gained a collapse/expand toggle (chevron rotates
  180°, `aria-expanded` + a `sr-only` collapse/expand label) — days start
  expanded (an itinerary being actively edited usually has only a
  handful, and hiding the "add stop" affordance by default would cost
  more than it saves), collapsing is what keeps a many-day itinerary
  scannable on a phone once its stops are filled in.
- **View transitions** — progressive enhancement, no library. React's
  `<ViewTransition>` component needs `react@canary`; this project runs
  stable React 19.2, so the transition is driven entirely by
  `@tanstack/react-router`'s native `viewTransition` link/navigate option
  (confirmed in `router-core`: it already gates on `'startViewTransition'
  in document` before ever calling it — no manual feature-detection
  needed). `router.tsx` sets `defaultViewTransition: true` for a quiet
  root crossfade on every navigation; `ItineraryCard`'s link and
  `ItineraryHero`'s forked-from link additionally pass
  `viewTransition={{types: ['nav-forward']}}` for the app's one
  hierarchical (list → detail) navigation. CSS lives in `styles.css`:
  a 220ms ease-out-expo crossfade on the `root` view-transition group, plus
  a 16px directional slide gated behind the *native* CSS
  `:active-view-transition-type()` pseudo-class (itself progressive —
  unsupported browsers just keep the base crossfade), and the
  `prefers-reduced-motion` override zeroes every `::view-transition-*`
  animation duration (the page's existing blanket reduced-motion rule
  doesn't reach the view-transition pseudo-element tree, so this needed
  its own block). The detail page's back button intentionally does *not*
  tag a `nav-back` type — it calls `router.history.back()` directly,
  which still flows through the router's own history object (so the base
  crossfade still fires) without the extra type wiring a `Link` would
  need.
- **`eslint.config.js`**: added `.agents/` to `ignores`. Pre-existing
  failure (`pnpm lint` errored on vendored, non-TS skill tooling scripts
  under `.agents/skills/*/scripts/`) unrelated to any behavior change,
  fixed here only because this task's gate list requires `pnpm lint` to
  pass cleanly.

## Consistency checks

Hold every future UI change to: spacing on the 4px grid, shadow-only elevation (no border+shadow combo), colors only from the table above, Fraunces only on content titles, and the component measurements listed here reused rather than reinvented.
