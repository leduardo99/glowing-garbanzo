import { useEffect, useState } from 'react'

/**
 * Matches Tailwind's `md` breakpoint (768px) — anything narrower is treated
 * as the mobile/app-shell layout throughout the redesign (chip-row filters,
 * bottom sheets, the immersive detail hero).
 */
const MOBILE_MEDIA_QUERY = '(max-width: 767px)'

/**
 * Client-only viewport check used to switch between structurally different
 * components for the same control (e.g. `Dialog` on desktop vs `Drawer` on
 * mobile) — CSS alone can't do this since the two use different underlying
 * primitives/state, unlike a plain `hidden md:block` toggle.
 *
 * Always returns `false` on the server and on the very first client render,
 * then updates from `matchMedia` in an effect. This deliberately mirrors
 * what the server rendered (avoiding a hydration mismatch warning) and
 * corrects itself a tick later — the same pattern shadcn's own
 * `use-mobile` hook uses.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY)
    const update = () => setIsMobile(mediaQueryList.matches)
    update()
    mediaQueryList.addEventListener('change', update)
    return () => mediaQueryList.removeEventListener('change', update)
  }, [])

  return isMobile
}
