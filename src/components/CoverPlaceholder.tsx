import { CompassIcon } from 'lucide-react'

import { cn } from '#/lib/utils'

/**
 * Branded placeholder for itineraries without a cover photo — a
 * terracotta-tinted diagonal pattern with a centered compass mark, never a
 * flat gray box (PRODUCT.md's anti-references explicitly call that out as
 * a "native-web afterthought" tell). Shared by the discovery card
 * (`ItineraryCard`) and the mobile immersive detail hero (`ItineraryHero`)
 * so the "no cover" treatment reads as one consistent brand mark
 * throughout the app rather than two different gray-void fallbacks.
 */
export function CoverPlaceholder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center bg-terracotta-soft bg-[repeating-linear-gradient(135deg,oklch(0.58_0.15_38_/_0.1)_0px,oklch(0.58_0.15_38_/_0.1)_2px,transparent_2px,transparent_14px)]',
        className,
      )}
    >
      <CompassIcon
        className="size-9 text-terracotta/40 sm:size-12"
        strokeWidth={1.5}
      />
    </div>
  )
}
