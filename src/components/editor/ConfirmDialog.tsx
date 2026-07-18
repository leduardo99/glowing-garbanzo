import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { m } from '#/paraglide/messages'

/**
 * Reusable "are you sure?" dialog wrapping a trigger element — used by
 * DayEditor (remove day/stop), PublishCard is unaffected (no destructive
 * confirms there), and MembersCard (regenerate/revoke invite link, remove
 * member). Closes itself after `onConfirm` resolves.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = 'destructive',
}: {
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => unknown
  variant?: 'destructive' | 'default'
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{m.confirm_cancel()}</Button>
          </DialogClose>
          <Button
            variant={variant}
            onClick={async () => {
              await onConfirm()
              setOpen(false)
            }}
          >
            {confirmLabel ?? m.confirm_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
