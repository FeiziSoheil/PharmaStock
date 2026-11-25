'use client'

import * as React from 'react'
import { useShellDrawerHost } from '@/components/layout/shell-drawer-context'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type SideDrawerProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  trigger?: React.ReactNode
  /** Logical side. Default `end` → physical left in RTL (opposite the nav rail). */
  side?: 'start' | 'end'
  className?: string
}

/**
 * Form / detail side drawer.
 * Inside AppShell (desktop/tablet): push island that shrinks main content (3-column shell).
 * Outside shell / mobile: overlay Sheet (unchanged).
 */
function SideDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  side = 'end',
  className,
}: SideDrawerProps) {
  const host = useShellDrawerHost()
  const push = Boolean(host?.pushEnabled)

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? Boolean(open) : uncontrolledOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  React.useLayoutEffect(() => {
    if (!push || !host) return
    host.publish({
      open: isOpen,
      title,
      description,
      body: children,
      footer,
      side,
      className,
      onOpenChange: setOpen,
    })
    return () => {
      host.publish(null)
    }
  }, [
    push,
    host,
    isOpen,
    title,
    description,
    children,
    footer,
    side,
    className,
    setOpen,
  ])

  if (push) {
    if (!trigger) return null
    return (
      <span data-slot="side-drawer-trigger">
        {React.isValidElement(trigger)
          ? React.cloneElement(
              trigger as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
              {
                onClick: (event: React.MouseEvent) => {
                  ;(
                    trigger as React.ReactElement<{
                      onClick?: (e: React.MouseEvent) => void
                    }>
                  ).props.onClick?.(event)
                  if (!event.defaultPrevented) setOpen(true)
                },
              },
            )
          : trigger}
      </span>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        data-pattern="side-drawer"
        side={side}
        className={cn('w-full sm:max-w-[var(--ps-drawer-width)]', className)}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div
          data-slot="side-drawer-body"
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {children}
        </div>
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  )
}

export { SideDrawer }
