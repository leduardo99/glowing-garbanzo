---
name: Roteiros
description: A community platform for publishing, forking, and rating travel itineraries — built like a shared travel journal, not a booking dashboard.
colors:
  ink: "oklch(0.24 0.02 45)"
  ink-soft: "oklch(0.45 0.02 45)"
  paper: "oklch(0.985 0.004 60)"
  surface: "oklch(0.97 0.006 55)"
  surface-sunken: "oklch(0.94 0.008 55)"
  terracotta: "oklch(0.58 0.15 38)"
  terracotta-deep: "oklch(0.49 0.16 35)"
  terracotta-soft: "oklch(0.93 0.04 45)"
  rating-gold: "oklch(0.78 0.15 85)"
  line: "oklch(0.24 0.02 45 / 0.12)"
  line-strong: "oklch(0.24 0.02 45 / 0.2)"
  success: "oklch(0.6 0.12 145)"
  warning: "oklch(0.75 0.14 80)"
  destructive: "oklch(0.55 0.2 15)"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.1
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
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
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
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  card-itinerary:
    backgroundColor: "{colors.paper}"
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

**Creative North Star: "The Shared Logbook"**

Roteiros feels like a well-kept travel logbook that gets handed from traveler to traveler, each one annotating, forking, and carrying it forward. That's the literal product (fork an itinerary, make it yours) and it's the visual idea too: warm paper tones, a serif hand for the things that matter (trip and day titles), a quiet sans for everything you use to navigate and act, and a single warm accent — terracotta, the color of a well-worn passport cover, sunbaked roof tiles, a leather journal strap — spent only where it means something.

This system explicitly rejects the generic AI-tool look: no Inter-everywhere, no purple-to-blue gradient, no cards nested inside cards, no gray text sitting on a colored background, no rounded-square icon tile perched above every heading, no dense boxed-metric SaaS-dashboard chrome. It also rejects "responsive as an afterthought" — most people open Roteiros on a phone, so the mobile layout is the native-feeling one (bottom tab bar, safe-area insets, ≥44px targets), not a squeezed desktop page.

**Key Characteristics:**
- Warm, editorial, unhurried — a travel journal, not a booking dashboard
- One accent (terracotta) carries every call to action and every selected state; nothing else competes with it
- Serif (Fraunces) marks *content* — itinerary titles, day headers; sans (Karla) runs the *interface* — nav, buttons, labels, data
- Cards are quiet: shadow and warm-paper tone do the separating, not borders or nested boxes
- Mobile is a native-feeling app shell: bottom tabs, safe areas, generous touch targets

## 2. Colors

Restrained strategy: warm-tinted neutrals carry almost the entire surface; terracotta is the only saturated color, spent on primary actions, current selection, and rating stars only.

### Primary
- **Terracotta** (`oklch(0.58 0.15 38)`): the one accent. Primary buttons, active tab/nav state, focus rings, selected filter chips, links inside prose. Nothing else is this saturated.

### Secondary
- **Rating Gold** (`oklch(0.78 0.15 85)`): a second, deliberately distinct warm hue reserved for the star-rating system only (filled stars, average-rating badge). It is a semantic color, not a second brand accent — it never appears on a button or a nav item.

### Neutral
- **Ink** (`oklch(0.24 0.02 45)`): primary text, on both paper and surface.
- **Ink Soft** (`oklch(0.45 0.02 45)`): secondary text — metadata, captions, muted labels. Always checked against its background at ≥4.5:1; never the washed-out light-gray-on-tint failure the interface could easily fall into.
- **Paper** (`oklch(0.985 0.004 60)`): the page background. A true off-white with only a hair of the accent's own hue (0.004 chroma) — deliberately not the saturated "AI cream/sand" default; warmth here comes from typography and the terracotta accent, not a tinted body background.
- **Surface** (`oklch(0.97 0.006 55)`): cards, the top nav bar, the bottom tab bar — one calm step off paper, distinguishing "chrome" from "page" without a hard edge.
- **Surface Sunken** (`oklch(0.94 0.008 55)`): inputs, search fields, tag pills — inset surfaces that read as "you act here," always slightly *darker* than their surroundings, never lighter.
- **Line** (`oklch(0.24 0.02 45 / 0.12)`) / **Line Strong** (`oklch(0.24 0.02 45 / 0.2)`): dividers, input borders, table rows. Low-opacity so they disappear until you look for them.

### Named Rules
**The One Warm Voice Rule.** Terracotta is the only saturated brand color on any screen. Rating Gold is a semantic exception scoped strictly to ratings. If a third saturated color shows up anywhere else, it's a bug, not a feature.

**The No-Cream-Default Rule.** The page background is a true off-white (chroma 0.004), not a saturated sand/parchment tone. Warmth is carried by the terracotta accent and the Fraunces display type, never by tinting the whole canvas beige "for elegance."

## 3. Typography

**Display Font:** Fraunces (variable, optical size axis), with Georgia/serif fallback
**Body Font:** Karla, with ui-sans-serif/system-ui fallback
**Label/Mono Font:** Karla with `font-variant-numeric: tabular-nums` for any dynamic number (day counts, ratings, prices) — no separate mono family; one UI sans keeps the interface calm.

**Character:** Fraunces brings the editorial, slightly wonky warmth of a hand-set travel journal to the things a traveler actually reads for — trip titles, day headers. Karla is a humanist grotesk with generous diacritic support for pt-BR, carrying every interface surface (nav, buttons, forms, data, badges) so the tool itself stays quiet and legible.

### Hierarchy
- **Display** (Fraunces 500, 32px page/itinerary titles up to 40px on the itinerary hero, line-height 1.1, letter-spacing -0.02em): the trip or itinerary's own name — the one thing on the page that gets to be a serif headline.
- **Headline** (Karla 600, 22px, line-height 1.25): section headers — "Days," "Comments," "Similar itineraries."
- **Title** (Karla 600, 17px, line-height 1.3): card titles in the discovery grid, day headers ("Day 3 · Rio de Janeiro"), stop names.
- **Body** (Karla 400, 15px, line-height 1.55, capped 70ch): stop descriptions, comments, bios. Never drops below 4.5:1 contrast against paper or surface.
- **Label** (Karla 500, 13px, letter-spacing 0.02em): form labels, nav items, tab labels, button text.
- **Caption** (Karla 400, 12px): timestamps, rating counts, tag text, day/stop metadata.

### Named Rules
**The Editorial Title Rule.** Fraunces is reserved for *content* titles a traveler wrote or is reading — the itinerary name and nothing else. Every piece of interface chrome (buttons, nav, badges, form labels, table/list data) stays in Karla. This is the one deliberate display-font exception in an otherwise single-family product UI, and it doesn't leak past titles.

**The 70ch Rule.** Day and stop descriptions, comments, and any long-form prose wrap at ≤70ch regardless of viewport width.

## 4. Elevation

Roteiros uses soft, warm-tinted ambient shadows for lifted surfaces — cards, dropdowns, sheets, modals — rather than borders. Borders are reserved for dividers, input outlines, and table/list rows; cards never carry a visible border on top of their shadow (the "ghost card" combination of a hard 1px border plus a wide soft shadow is explicitly avoided). In dark mode, shadows barely register, so elevation collapses to a single 1px light-ring per surface instead.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px rgba(36,20,10,0.04), 0 1px 1px rgba(36,20,10,0.03)`): itinerary cards, list rows at rest.
- **Lifted** (`box-shadow: 0 4px 12px rgba(36,20,10,0.08), 0 1px 2px rgba(36,20,10,0.04)`): card hover, open dropdown/menu.
- **Elevated** (`box-shadow: 0 12px 32px rgba(36,20,10,0.14), 0 2px 6px rgba(36,20,10,0.06)`): modal, sheet, popover.
- **Dark-mode ring** (`box-shadow: 0 0 0 1px rgba(255,255,255,0.08)`): replaces all three above when `.dark` is active — depth shadows don't read on dark surfaces, so a light hairline ring carries the same "lifted" meaning instead.

### Named Rules
**The Quiet Lift Rule.** Shadow is how a surface separates from the page; borders are reserved for dividers, inputs, and rows. Never both a border and a shadow on the same card.

## 5. Components

### Buttons
- **Shape:** 10px radius (`rounded.md`); pill (`rounded.full`) only for the floating "New itinerary" mobile action.
- **Primary:** terracotta background, paper text, 10px×20px padding, 40px height (44px on the mobile bottom-bar CTA). Hover → terracotta-deep. Active → `transform: scale(0.97)`.
- **Secondary / Ghost:** surface background (or transparent for ghost), ink text, line border on secondary only; ghost has no border, just a surface-tint hover.
- **Hover / Focus:** background shift + a 2px terracotta focus ring offset 2px, never a border-color-only change (fails the squint test on this palette).

### Chips / Tags
- **Style:** surface-sunken background, ink-soft text, full radius, no border. Selected/active filter chips flip to terracotta-soft background with terracotta text — the only place a tag carries color.

### Cards / Containers
- **Corner Style:** 14px radius (`rounded.lg`); a cover photo inside a card uses `outerRadius − padding` so the image corner and card corner stay concentric, never sharing the same radius flush against each other.
- **Background:** paper, lifted with the Resting shadow; Lifted shadow on hover, no color or border change.
- **Shadow Strategy:** see Elevation — shadow only, never combined with a border.
- **Internal Padding:** 16px standard, 24px between major content blocks within a card.

### Inputs / Fields
- **Style:** surface-sunken (inset, always darker than its surroundings) background, 1px line border, 6px radius (`rounded.sm`), 40px height, 10px/12px padding.
- **Focus:** border shifts to terracotta plus a 2px terracotta ring at 20% opacity — no glow/blur effects.
- **Error:** border and label switch to destructive; helper text below in destructive at label size.

### Navigation
- **Desktop:** a quiet top bar — wordmark in Label-weight Karla (not Fraunces; navigation is chrome, not content), search, primary nav links, avatar menu. Surface background, Line-strong bottom border, no shadow.
- **Mobile (native-feeling):** a fixed bottom tab bar — Home/Search, My Itineraries, New (elevated pill button), Profile — surface background, safe-area-inset-bottom padding, icon + 11px label per tab, active tab in terracotta with a filled icon variant, all tap targets ≥44×44px.
- **Transitions:** route pushes/pops use a 200-280ms slide+fade; switching bottom tabs is a same-level crossfade only (tabs are peers, not a stack) — see Do's and Don'ts for the full motion rule.

### Day/Stop Timeline (signature component)
The itinerary detail page's core structure: a vertical "logbook spine." A thin `line` runs down the left edge; each day is a Title-weight Karla marker ("Day 3 · Rio de Janeiro") breaking the spine, with its stops listed beneath as quiet rows — thumbnail, stop name (Title), notes (Body) — never boxed into a card-within-a-card. This is the one structural element unique to Roteiros and the clearest place the "logbook" idea should be visible.

## 6. Do's and Don'ts

### Do:
- **Do** spend terracotta only on primary actions, the current selection, links, and focus rings — everywhere else stays neutral.
- **Do** set itinerary and trip titles in Fraunces; set every other piece of UI text in Karla.
- **Do** build the mobile nav as a real bottom tab bar with safe-area insets and ≥44px targets — mobile is the primary surface, not a fallback.
- **Do** use shadow, not borders, to lift cards, dropdowns, sheets, and modals.
- **Do** keep body copy ≤70ch and verify Portuguese strings (typically 20-30% longer than English) don't truncate or overflow labels, tabs, and buttons.
- **Do** give the rating-star and duration/day-count numbers `tabular-nums` so they don't jitter.

### Don't:
- **Don't** default to Inter or any generic system-sans stack for headings — Fraunces carries content titles, Karla carries everything else.
- **Don't** use a purple-to-blue gradient anywhere, on text or on a surface — the accent is terracotta, full stop.
- **Don't** nest a card inside a card. Use the Day/Stop timeline's quiet-row pattern instead.
- **Don't** put ink-soft (or any gray) text directly on a terracotta or rating-gold background — use paper text on saturated fills, or a darker shade of the fill's own hue.
- **Don't** put a rounded-square icon tile above section headings as a default decoration.
- **Don't** combine a 1px border and a wide soft box-shadow on the same card (the "ghost card" tell) — pick the shadow, drop the border.
- **Don't** exceed 20px corner radius on cards, inputs, or sections; full-pill radius is reserved for tags, chips, and the floating mobile CTA.
- **Don't** run choreographed page-load animations — Roteiros loads into a task, it doesn't perform an entrance.
