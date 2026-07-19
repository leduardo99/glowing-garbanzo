---
name: Roteiros
description: A community platform for publishing, forking, and rating travel itineraries — a drawn route handed from traveler to traveler, not a booking dashboard.
colors:
  ink: "oklch(0.27 0.035 155)"
  ink-soft: "oklch(0.47 0.025 150)"
  paper: "oklch(0.972 0.009 84)"
  surface: "oklch(0.988 0.005 88)"
  surface-sunken: "oklch(0.945 0.012 84)"
  mata: "oklch(0.40 0.09 152)"
  mata-deep: "oklch(0.34 0.09 152)"
  mata-soft: "oklch(0.93 0.03 150)"
  amber: "oklch(0.60 0.13 70)"
  coral: "oklch(0.55 0.16 30)"
  line: "oklch(0.27 0.035 155 / 0.12)"
  line-strong: "oklch(0.27 0.035 155 / 0.2)"
  success: "oklch(0.52 0.11 150)"
  warning: "oklch(0.70 0.13 80)"
  destructive: "oklch(0.50 0.19 25)"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Karla, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Karla, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Karla, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Karla, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    letterSpacing: "0.02em"
  caption:
    fontFamily: "Karla, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.01em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.mata}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.mata-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  card-itinerary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0px"
  badge-tag:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  input-field:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "40px"
---

# Design System: Roteiros

## 1. Overview

**Creative North Star: "Trilha Tropical" (the drawn route)**

Roteiros is a route sketched on a map and handed from traveler to traveler — each one forks it, annotates it, and carries it forward. The product's literal signature IS its visual signature: a dashed amber route connecting numbered stops, drawn over deep forest green and warm cream. The palette is Brazilian without costume: the green of mata atlântica, the amber of late-afternoon light and cerrado earth, cream like cotton paper — the register of a specialty-coffee label or a botanical field guide, never a tourist trinket.

References carried in, deliberately: **Airbnb** for the warm float (bright cards on a warm page, generous radii, photography treated kindly, interface that recedes behind content) and **Polarsteps** for the travel-native structure (the map and the route are protagonists; the trip is a line through places, and the app celebrates that line).

This system explicitly rejects the generic AI-tool look: no Inter-everywhere, no purple-to-blue gradient, no cards nested inside cards, no gray text sitting on a colored background, no rounded-square icon tile perched above every heading, no dense boxed-metric SaaS-dashboard chrome. It also rejects "responsive as an afterthought" — most people open Roteiros on a phone, so the mobile layout is the native-feeling one (bottom tab bar, safe-area insets, ≥44px targets), not a squeezed desktop page.

**Key Characteristics:**
- Warm, unhurried, travel-native — a drawn route, not a booking dashboard
- One brand voice (deep mata green) carries every call to action and selected state
- The route itself is the recurring visual motif: on the map, in cover placeholders, in empty states, echoed by the numbered timeline
- Serif (Fraunces) marks *content* — itinerary titles, day headers; sans (Karla) runs the *interface*
- Cards float bright on a cream page (shadow, not borders); mobile is a native-feeling app shell

## 2. Colors

Restrained strategy: warm cream neutrals carry almost the entire surface; deep mata green is the only voice with authority; amber and coral are scoped semantics, never brand accents.

### Primary
- **Mata** (`oklch(0.40 0.09 152)`): the one brand voice. Primary buttons, active tab/nav state, focus rings, selected filter chips, links. Deep enough to read as ink, green enough to read as forest. Dark mode flips it to a bright leaf green (`oklch(0.70 0.11 150)`) with near-black text.

### Scoped semantics (never on buttons or nav)
- **Amber** (`oklch(0.60 0.13 70)`): rating stars AND the drawn route line — the two places the product "glows." A route sketched in amber pencil over the map is the signature; stars share the hue so "quality" and "journey" feel like the same warm material.
- **Coral** (`oklch(0.55 0.16 30)`): the favorite heart's filled state only. A single point of delight, Airbnb-style.

### Neutral
- **Ink** (`oklch(0.27 0.035 155)`): primary text — green-black, like bottle-green ink, on both paper and surface.
- **Ink Soft** (`oklch(0.47 0.025 150)`): secondary text — metadata, captions, muted labels. AA-verified ≥4.5:1 on paper, surface, and sunken.
- **Paper** (`oklch(0.972 0.009 84)`): the page background — a *visible* warm cream (this is deliberate: the previous system's near-white paper read as generic shadcn; warmth must be perceivable at a glance).
- **Surface** (`oklch(0.988 0.005 88)`): cards, popovers, nav chrome — *lighter* than the page, floating on it with shadow (the Airbnb float). This inverts the old paper/surface relationship on purpose.
- **Surface Sunken** (`oklch(0.945 0.012 84)`): inputs, search fields, tag pills — inset surfaces that read as "you act here," always darker than their surroundings.
- **Line / Line Strong** (`oklch(0.27 0.035 155 / 0.12 · 0.2)`): dividers, input borders, list rows. Green-ink at low opacity so they disappear until you look for them.

### Contrast (verified, WCAG AA)
All pairs checked computationally in both themes (script: oklch → sRGB → relative luminance): ink/paper 13.7, ink-soft/paper 6.2, ink-soft/sunken 5.7, cream-on-mata button 8.5, mata-as-link/paper 8.1, destructive/paper 6.1; dark: ink/paper 16.3, ink-soft/surface 6.9, dark-text-on-mata button 7.6, amber large-text 8.2. Re-run the check when touching any token.

### Named Rules
**The One Green Voice Rule.** Mata is the only color with authority on any screen. Amber is scoped to stars + the route line; coral to the filled favorite heart. A fourth saturated color anywhere is a bug.

**The Visible Warmth Rule.** The cream page must be perceivably warm next to a white card — that adjacency (bright card floating on cream) is what separates this from default-shadcn white-on-white. Never flatten paper back toward pure white "for cleanliness."

## 3. Typography

**Display Font:** Fraunces (variable, optical size axis), with Georgia/serif fallback
**Body Font:** Karla, with ui-sans-serif/system-ui fallback
**Label/Mono Font:** Karla with `font-variant-numeric: tabular-nums` for any dynamic number (day counts, ratings, prices) — no separate mono family.

**Character:** Fraunces brings the editorial warmth of a field journal to the things a traveler reads for — trip titles, day headers. Karla is a humanist grotesk with generous diacritic support for pt-BR, carrying every interface surface so the tool stays quiet.

### Hierarchy
- **Display** (Fraunces 500, 36px, up to 44px on the itinerary hero, line-height 1.08, letter-spacing -0.02em): the trip's own name — the one serif headline on a page.
- **Headline** (Karla 600, 22px): section headers — "Days," "Comments."
- **Title** (Karla 600, 17px): card titles, day headers ("Day 3 · Rio"), stop names.
- **Body** (Karla 400, 15px, line-height 1.55, capped 70ch): descriptions, comments.
- **Label** (Karla 500, 13px, letter-spacing 0.02em): form labels, nav, buttons.
- **Caption** (Karla 400, 12px): timestamps, counts, tags, metadata.

### Named Rules
**The Editorial Title Rule.** Fraunces marks *content* titles a traveler wrote or is reading — itinerary and day names, nothing else. All chrome stays in Karla.

**The 70ch Rule.** Long-form prose wraps at ≤70ch regardless of viewport.

## 4. Elevation

Light mode floats cards off the cream page with green-ink-tinted layered shadows (ring + two soft depths); borders are reserved for dividers, input outlines, and rows. Dark mode collapses all elevation to a light hairline ring. Never a visible border *and* a shadow on the same card.

### Shadow Vocabulary (as `shadow-resting` / `shadow-lifted` / `shadow-elevated` utilities)
- **Resting**: cards, list rows at rest — hairline ring + soft 1-2px depth.
- **Lifted**: card hover, open dropdown/menu.
- **Elevated**: modal, sheet, popover.
- **Dark-mode ring** (`0 0 0 1px oklch(1 0 0 / 0.08-0.12)`): replaces all three when `.dark` is active.

### Named Rules
**The Quiet Lift Rule.** Shadow separates surface from page; borders are for dividers, inputs, and rows. Never both on the same card.

## 5. Components

### Buttons
- **Shape:** 12px radius (`rounded.md`); pill only for chips and the floating mobile CTA.
- **Primary:** mata background, cream text; hover → mata-deep; active → `scale(0.97)`. Dark mode: bright leaf green with near-black text.
- **Secondary / Ghost:** surface with line border / transparent with sunken hover.
- **Focus:** 2px mata ring offset 2px — never a border-color-only change.

### Chips / Tags
- Surface-sunken background, ink-soft text, full radius, no border. Selected filter chips flip to mata-soft background with mata-soft-foreground text — the only place a tag carries color.

### Cards / Containers
- 16px radius (`rounded.lg`); cover photos use concentric radii (`outer − padding`).
- Surface (near-white) background floating on cream paper with the Resting shadow; Lifted on hover. No borders.
- Internal padding 16px standard, 24px between major blocks.

### Inputs / Fields
- Surface-sunken background, 1px line border, 8px radius, 40px height.
- Focus: border → mata plus a 2px mata ring at 20% opacity. Error: destructive border + helper text.

### Navigation
- **Desktop:** quiet top bar — wordmark in Karla, nav links, avatar. Surface background, line bottom border.
- **Mobile:** fixed bottom tab bar — surface background, safe-area-inset-bottom, icon + 11px label, active tab in mata with filled icon, ≥44px targets.
- **Transitions:** route pushes 220ms slide+fade; tab switches crossfade only.

### The Drawn Route (signature system)
The one element that could only be Roteiros', appearing in three registers that echo each other:
1. **On the map** (`ItineraryMap`): stops connected in visit order by a dashed **amber** route line; each stop is a numbered circular marker — mata disc, cream numeral — matching the timeline's numbering exactly, so map and list read as two views of the same journey (the Polarsteps DNA).
2. **As a sketch** (`RouteSketch`): a small generative SVG — dashed amber path wandering through numbered mata dots on cream — used as the cover placeholder for itineraries without photos, in empty states, and as the auth pages' brand mark. Never a gray box.
3. **As the timeline spine** (`DayTimeline`): the detail page's vertical line with numbered stop markers, same discs as the map pins.

### Day/Stop Timeline
A thin `line` spine down the left edge; each day is a Fraunces day-title breaking the spine; stops are quiet rows off numbered mata discs — never boxed into a card-within-a-card.

## 6. Do's and Don'ts

### Do:
- **Do** spend mata only on primary actions, selection, links, focus — everywhere else stays neutral.
- **Do** draw the route: any surface representing a trip without a photo gets the RouteSketch, never a gray void.
- **Do** number the stops identically on the map and in the timeline — they are one system.
- **Do** keep cards borderless and floating (shadow), and keep the cream page visibly warm behind them.
- **Do** verify pt-BR strings (20-30% longer than English) don't truncate; keep body ≤70ch; `tabular-nums` on all dynamic numbers.

### Don't:
- **Don't** put amber or coral on a button, nav item, or link — they are scoped to stars/route and the favorite heart.
- **Don't** default to Inter or size-only hierarchy; Fraunces carries content titles, Karla everything else.
- **Don't** nest cards, add icon-tile section headers, or combine border+shadow on one card.
- **Don't** use a purple-blue gradient anywhere; don't tint text gray on colored fills (cream text on mata, always).
- **Don't** exceed 24px radius on containers; pills are for chips and the floating CTA only.
- **Don't** run choreographed page-load animations. The one drawn animation is the RouteSketch path drawing itself in (240ms, once, reduced-motion safe).
