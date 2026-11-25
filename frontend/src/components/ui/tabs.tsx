'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

function Tabs({
  className,
  orientation = 'horizontal',
  dir = 'rtl',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      dir={dir}
      className={cn(
        'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
        className,
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  [
    'group/tabs-list inline-flex w-fit items-center justify-center rounded-default p-1',
    'text-text-secondary group-data-[orientation=horizontal]/tabs:min-h-10',
    'group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-surface-subtle',
        // Allow multi-line / wrapping lists (long Persian labels) without clipping into content
        line: 'h-auto gap-1 rounded-none bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex h-auto min-h-9 flex-1 items-center justify-center gap-1.5',
        'rounded-inner border border-transparent px-3 py-1.5',
        'text-body-md font-medium text-text-secondary transition-all',
        'hover:text-text-primary focus-visible:border-primary focus-visible:shadow-focus focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-surface data-[state=active]:text-primary',
        'group-data-[variant=default]/tabs-list:data-[state=active]:border-border-default',
        'group-data-[variant=default]/tabs-list:whitespace-nowrap',
        'group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent',
        'after:absolute after:bg-primary after:opacity-0 after:transition-opacity',
        'group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-0 group-data-[orientation=horizontal]/tabs:after:h-0.5',
        'group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:end-[-5px] group-data-[orientation=vertical]/tabs:after:w-0.5',
        'group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none focus-visible:shadow-focus', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
