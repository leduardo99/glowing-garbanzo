# Product

## Register

product

## Platform

web

## Users

Primary: Brazilian leisure travelers in their 20s-40s, planning or documenting a trip. They open Roteiros in short, interrupted bursts — on the bus, on the couch, between tasks — to browse itineraries for inspiration, and switch to a laptop when they're actually assembling a multi-day plan with stops and a map. The job: find a day-by-day itinerary they trust because a real traveler made it, fork it and adapt it to their own dates and taste, or publish their own route for the community. Some itineraries are private, shared with travel companions by invite link rather than published.

Secondary: international and English-reading travelers researching routes on the platform (served by the `en` locale) — same jobs, different language.

## Product Purpose

Roteiros is a community platform for publishing and discovering travel itineraries structured as days containing stops. Anyone can browse and search public itineraries, fork one as a starting point, rate and comment on itineraries they've used, and keep an itinerary private behind an invite link when it's just for their own trip. Success looks like: a visitor finds an itinerary worth forking within a couple of searches, and a returning traveler feels the app kept pace with them while they built their own — on their phone, in short sessions, without friction.

## Positioning

Real itineraries from travelers who actually went, that you fork and make your own — not another generic "top 10 things to do" list.

## Brand Personality

Elegant, calm, editorial — the feel of a well-kept travel journal, not a booking dashboard. Three words: refined, unhurried, well-traveled. The interface should read like a companion for planning a trip you're excited about, not a tool for filing an expense report.

## Anti-references

Explicitly reject: Inter-for-everything default typography; purple-to-blue gradients (the generic AI-tool tell); cards nested inside cards; gray text on a colored background; a rounded-square icon tile sitting above every section heading; the generic SaaS-dashboard feel (dense chrome, boxed metrics, icon-plus-label tiles repeated everywhere). Also reject anything that reads as a native-web afterthought on mobile — Roteiros' primary use is a phone in someone's hand, and it must feel like a native app there (bottom tab navigation, safe-area insets, touch-sized targets), not a shrunk desktop layout.

## Design Principles

The itinerary is the hero; chrome recedes. Days, stops, and photos carry the page — navigation, labels, and controls stay quiet so the content (someone's actual trip) leads.

One warm accent, spent deliberately. A single travel-warm accent color marks primary actions, current selection, and state — never decoration, never a gradient.

Native on mobile, not merely responsive. Bottom tab navigation, safe-area insets, and ≥44px touch targets are first-class on small screens, built in from the start, not bolted on after a desktop-first pass. The app is planned toward a standalone PWA.

Typographic hierarchy does the work that boxes usually do. Weight, size, and a deliberate serif/sans contrast establish what matters on a screen — not icon tiles, not colored borders, not nested cards.

Calm, purposeful motion. Transitions confirm state and feel native to a phone; nothing is choreographed for its own sake.

## Accessibility & Inclusion

WCAG AA contrast (≥4.5:1 body text, ≥3:1 large text) in both light and dark themes. `prefers-reduced-motion` has a full crossfade/instant-transition alternative for every animation. Touch targets ≥44×44px throughout, with generous hit areas around small controls (star ratings, tag remove buttons, map pins). Portuguese UI strings commonly run 20-30% longer than their English equivalents — layouts must tolerate that without truncation or overflow (see the i18n note in DESIGN.md's Do's and Don'ts). Map interactions (MapLibre stop pins) need a keyboard/focus-visible alternative alongside pointer interaction.
