import { cn } from '#/lib/utils'

/**
 * Pins the light-theme Trilha Tropical tokens on a subtree so product
 * specimens (the landing collage, the auth panel's preview) render as a
 * consistent "printed screenshot" of the app — bright cream card on any
 * host surface, identical in light and dark and on the theme-invariant
 * mata panels. Shadcn slot vars (--card etc.) alias the base tokens via
 * var() indirection, so overriding the base set here re-themes every
 * component inside without touching them.
 *
 * Purely presentational: specimens are decorative previews, so the whole
 * frame is aria-hidden and inert to pointers.
 */
const LIGHT_TOKENS: Record<string, string> = {
  '--paper': 'oklch(0.972 0.009 84)',
  '--surface': 'oklch(0.988 0.005 88)',
  '--surface-sunken': 'oklch(0.945 0.012 84)',
  '--ink': 'oklch(0.27 0.035 155)',
  '--ink-soft': 'oklch(0.47 0.025 150)',
  '--mata': 'oklch(0.4 0.09 152)',
  '--mata-deep': 'oklch(0.34 0.09 152)',
  '--mata-soft': 'oklch(0.93 0.03 150)',
  '--amber': 'oklch(0.6 0.13 70)',
  '--coral': 'oklch(0.55 0.16 30)',
  '--line': 'oklch(0.27 0.035 155 / 0.12)',
  '--line-strong': 'oklch(0.27 0.035 155 / 0.2)',
  '--primary-foreground': 'oklch(0.985 0.006 88)',
  '--shadow-resting-value':
    '0 0 0 1px oklch(0.27 0.035 155 / 0.05), 0 1px 2px oklch(0.27 0.035 155 / 0.06), 0 2px 6px oklch(0.27 0.035 155 / 0.05)',
  '--shadow-lifted-value':
    '0 0 0 1px oklch(0.27 0.035 155 / 0.05), 0 4px 12px oklch(0.27 0.035 155 / 0.11), 0 1px 3px oklch(0.27 0.035 155 / 0.07)',
}

export function SpecimenFrame({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none select-none', className)}
      style={LIGHT_TOKENS}
    >
      {children}
    </div>
  )
}
