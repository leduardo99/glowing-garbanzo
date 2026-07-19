/**
 * The drawn-route signature (DESIGN.md §5 "The Drawn Route"): a small
 * generative SVG — a dashed amber path wandering through numbered mata
 * dots — used wherever a trip has no photo to show: card cover
 * placeholders, empty states, the auth pages' brand mark.
 *
 * Deterministic: the same `seed` (itinerary slug, title, or any stable
 * string) always draws the same route, so a card doesn't reshuffle its
 * placeholder between renders or visits. Purely decorative
 * (`aria-hidden`); colors come from the theme tokens so the sketch adapts
 * to light/dark automatically.
 */
import { useId } from 'react'

import { cn } from '#/lib/utils'

/** Small deterministic PRNG (mulberry32) seeded from a string hash. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface RoutePoint {
  x: number
  y: number
}

/** Left-to-right meander through the 100×64 viewBox, `count` stops. */
function generateStops(seed: string, count: number): RoutePoint[] {
  const rand = seededRandom(seed)
  const points: RoutePoint[] = []
  const margin = 12
  const usable = 100 - margin * 2
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    points.push({
      x: margin + usable * t + (rand() - 0.5) * (usable / count) * 0.8,
      y: 16 + rand() * 32,
    })
  }
  return points
}

/** Smooth cubic path through the points (Catmull-Rom → Bézier). */
function buildPath(points: RoutePoint[]): string {
  if (points.length < 2) {
    return ''
  }
  const d: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
    )
  }
  return d.join(' ')
}

export function RouteSketch({
  seed,
  stops = 4,
  numbered = false,
  tone = 'default',
  className,
}: {
  /** Stable string (slug/title) — same seed, same route. */
  seed: string
  /** How many dots the route passes through (3-6 reads best). */
  stops?: number
  /** Show tiny numerals inside the dots — legible only at larger render sizes. */
  numbered?: boolean
  /** `oncolor` flips the dots to cream for sketches drawn over a mata fill (e.g. the auth brand panel). */
  tone?: 'default' | 'oncolor'
  className?: string
}) {
  const id = useId()
  const points = generateStops(seed, Math.min(6, Math.max(2, stops)))
  const path = buildPath(points)
  const dotFill = tone === 'oncolor' ? 'var(--primary-foreground)' : 'var(--mata)'

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 64"
      preserveAspectRatio="xMidYMid meet"
      className={cn('block', className)}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--amber)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="4 3.2"
      />
      {points.map((p, i) => {
        const isLast = i === points.length - 1
        return (
          <g key={`${id}-${i}`}>
            {isLast ? (
              // The destination reads as "you arrive here": a ringed dot.
              <>
                <circle cx={p.x} cy={p.y} r={5} fill="none" stroke={dotFill} strokeWidth="1.4" />
                <circle cx={p.x} cy={p.y} r={2} fill={dotFill} />
              </>
            ) : (
              <circle cx={p.x} cy={p.y} r={4.4} fill={dotFill} />
            )}
            {numbered && !isLast ? (
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="5"
                fontFamily="var(--font-sans)"
                fontWeight="600"
                fill={tone === 'oncolor' ? 'var(--mata)' : 'var(--primary-foreground)'}
              >
                {i + 1}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
