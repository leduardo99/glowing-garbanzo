import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import { useIsMobile } from '#/hooks/use-is-mobile'

/**
 * A modal surface that's a centered `Dialog` on desktop and a bottom
 * `Drawer` on mobile — the two use structurally different primitives
 * (different open/close semantics, different portal targets), so this
 * can't be a CSS-only responsive swap the way the home page's filter chip
 * row is. Used for the editor's stop add/edit form (DESIGN.md's mobile
 * app-shell shift: forms belong in a sheet the thumb can reach, not a
 * centered box).
 *
 * `useIsMobile` defaults to `false` on the server and the first client
 * render, so SSR and initial hydration always render the `Dialog` branch —
 * no hydration mismatch, see that hook's doc comment.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
