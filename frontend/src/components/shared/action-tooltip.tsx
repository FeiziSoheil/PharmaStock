'use client'

import * as React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface ActionTooltipProps {
  title: React.ReactNode
  description?: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  delayDuration?: number
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Action tooltip for table action buttons and links.
 * Shows a concise title when hovered.
 */
export function ActionTooltip({
  title,
  side = 'top',
  sideOffset = 6,
  delayDuration = 150,
  children,
  className,
  contentClassName,
}: ActionTooltipProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={sideOffset}
          data-slot="action-tooltip"
          className={cn(
            'pointer-events-none text-label-sm font-medium text-text-inverse px-2.5 py-1 shadow-md border border-border-default/20 whitespace-nowrap',
            className,
            contentClassName,
          )}
        >
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
