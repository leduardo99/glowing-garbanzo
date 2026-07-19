import { RouteSketch } from '#/components/RouteSketch'
import { cn } from '#/lib/utils'

/**
 * Branded placeholder for itineraries without a cover photo — the
 * drawn-route signature (see DESIGN.md §5 "The Drawn Route") over a soft
 * mata tint, never a flat gray box (PRODUCT.md's anti-references call
 * that out as a "native-web afterthought" tell). Shared by the discovery
 * card (`ItineraryCard`) and the detail hero (`ItineraryHero`) so the
 * "no cover" treatment reads as one consistent brand mark.
 *
 * `seed` keeps the sketch stable per itinerary (pass the slug or title):
 * each tripless cover gets its *own* route, but the same one every visit.
 */
export function CoverPlaceholder({
  seed = 'roteiros',
  className,
}: {
  seed?: string
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center overflow-hidden bg-mata-soft',
        className,
      )}
    >
      <RouteSketch
        seed={seed}
        stops={4}
        className="h-full max-h-40 w-full max-w-72 opacity-90"
      />
    </div>
  )
}
