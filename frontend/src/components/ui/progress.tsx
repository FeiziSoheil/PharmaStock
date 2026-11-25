'use client'

import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

function Progress({
  className,
  value = 0,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const clamped = Math.min(100, Math.max(0, value ?? 0))

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={clamped}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-primary-tint',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 origin-inline-start bg-primary transition-transform"
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
