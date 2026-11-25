'use client'

import * as React from 'react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-[var(--ps-z-drawer)] bg-backdrop',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

type SheetSide = 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end'

function resolveSheetSide(side: SheetSide): 'top' | 'bottom' | 'left' | 'right' {
  if (side === 'start') return 'right' // RTL: inline-start is physical right
  if (side === 'end') return 'left' // RTL: inline-end is physical left
  return side
}

function SheetContent({
  className,
  children,
  side = 'end',
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide
  showCloseButton?: boolean
}) {
  // Default `end` → physical left in RTL (form drawer opposite the right sidebar)
  const physicalSide = resolveSheetSide(side)

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        data-physical-side={physicalSide}
        className={cn(
          'fixed z-[var(--ps-z-drawer)] flex flex-col gap-4 bg-surface shadow-dialog',
          'transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300',
          'data-[state=open]:animate-in data-[state=open]:duration-500',
          physicalSide === 'right' &&
            'inset-y-0 right-0 h-full w-3/4 border-s border-border-default data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[var(--ps-drawer-width)]',
          physicalSide === 'left' &&
            'inset-y-0 left-0 h-full w-3/4 border-e border-border-default data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-[var(--ps-drawer-width)]',
          physicalSide === 'top' &&
            'inset-x-0 top-0 h-auto border-b border-border-default data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
          physicalSide === 'bottom' &&
            'inset-x-0 bottom-0 h-auto border-t border-border-default data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            className={cn(
              'absolute top-4 end-4 rounded-inner opacity-70 transition-opacity',
              'hover:opacity-100 focus-visible:outline-none focus-visible:shadow-focus',
              'disabled:pointer-events-none',
            )}
          >
            <Icon name="close" size={16} label="بستن" data-slot="icon" />
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        'text-headline-sm font-semibold text-text-primary',
        className,
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-body-md text-text-secondary', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
