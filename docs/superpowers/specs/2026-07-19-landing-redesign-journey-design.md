# Landing redesign — "the page is a journey"

**Date:** 2026-07-19 · **Register:** brand (landing) · **Skills:** impeccable `bolder` + interface-design
**Supersedes** the hero/header/composition of the first landing pass (2026-07-19-landing-auth-restructure-design.md §landing). Server layer, shelves data, and `/explore` restructure are unchanged.

## Why

The first landing pass was structurally correct but visually timid: an app header reused as marketing chrome, a medium-sized headline stacked above a boxed map card, uniform `max-w-6xl` section rhythm. Any AI given "travel app landing" would produce it. The brand register demands commitment: one dominant idea per fold, a committed color moment, a signature no competitor could ship.

## The idea

Roteiros' signature is the drawn route — dashed amber through numbered mata stops — already alive in three registers (map, sketch, timeline). The landing becomes the fourth and largest: **the page itself is a route**. It departs, travels, and arrives:

1. **Departure** — a drenched deep-mata fold where the route draws itself in.
2. **The journey** — the community's real routes on a full-bleed map, then the best trips.
3. **The waypoints** — how-it-works as three stops on one literal dashed connector.
4. **Arrival** — the closing CTA under the ringed "you arrive here" destination mark.

No new colors, no new fonts, no new tokens. Bolder = the existing language used decisively.

## Sections

### Landing-owned chrome
`AppHeader` and `BottomNav` return `null` on `/` (landing is always anonymous — sessions redirect to `/explore`). The landing renders its own transparent header inside the hero: cream wordmark + glyph, Explorar link, ghost "Entrar", cream-filled "Criar conta". A minimal footer closes the page (wordmark, nav links, locale switcher, tagline).

### Hero — drenched departure (`min-h` ~88svh)
Theme-invariant deep mata (`oklch(0.34 0.09 152)`, same panel language as AuthShell's aside, same local CSS-var overrides so amber/cream stay tuned on the fill in both themes). Content:
- Fraunces cream headline at `clamp(2.5rem, 6.5vw, 5rem)`, `-0.02em`, balanced.
- Subtitle at cream/78, ≤34rem measure.
- CTAs: cream-filled primary (mata-deep text) + cream-outline ghost.
- **The signature moment:** a large `RouteSketch` (oncolor, ~5 stops) spanning the lower fold, its amber path **drawing itself in** (~1.4s ease-out, once) with stop dots popping in staggered as the path reaches them. This amplifies DESIGN.md's one sanctioned drawn animation into the hero register. CSS-only, `prefers-reduced-motion` collapses it to instantly-visible (global reduced-motion rule already covers it).
- Text block entrance: single staggered rise+fade (the brand-permitted orchestrated page-load), nothing scroll-triggered anywhere else.

### Community routes — full-bleed map band
Directly after the fold. Fraunces section title + one-line intro, then the live `LandingMap` **edge-to-edge** (no card box, hairline top/bottom borders), `~64vh` tall, with the drag/click hint floating as a paper/90 backdrop-blur chip over the map's bottom edge. Section renders only when geocoded routes exist — the hero's sketch already carries the signature when the map can't.

### Shelves — the best trips
Same `CardShelf` data/behavior; titles move to Fraunces (landing-scope exception to the Editorial Title Rule: on the marketing surface the section headings are the brand's storytelling voice, documented here), "Ver todos" becomes a quiet mata arrow-link.

### How it works — three stops, one route
The three steps become literal stops: numbered mata discs sitting **on a dashed amber connector** — horizontal behind the disc row on desktop, a vertical left spine on mobile (the DayTimeline grammar). The last disc carries the destination ring. This is a genuine ordered sequence (find → fork → travel), so the numbering carries information — not decorative section numbering.

### Arrival — closing CTA
Calm, centered, on paper (the hero owns the drenched moment now; repeating a mata band would flatten it). A short dashed amber lead-in descends into the ringed destination dot, then the Fraunces ink headline ("Sua próxima viagem começa num roteiro de verdade"), then primary mata CTA + quiet "Entrar" link.

## i18n

New keys (`landing_routes_title`, `landing_routes_intro`, `footer_tagline`) in both locales; everything else reuses existing `landing_*` keys. Paraglide recompiled.

## Non-goals

Server functions, shelves queries, `/explore`, auth pages: untouched. No parallax, no scroll-jacking, no glassmorphism, no gradients-as-decoration.

## Verification

Playwright screenshots at 390/1440 in light + dark (hero invariant; shelves/steps/arrival theme-aware), overflow check with pt-BR strings, AA contrast on all new pairs (cream on mata already verified 8.5:1; amber-on-mata is decorative line-work only), then `pnpm lint` / `tsc` / `build` / `test`.
