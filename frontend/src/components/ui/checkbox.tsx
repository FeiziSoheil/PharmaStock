'use client'

import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-4 shrink-0 rounded-checkbox border border-border-strong bg-surface',
        'transition-[color,box-shadow,background-color,border-color] outline-none',
        'hover:border-primary focus-visible:border-primary focus-visible:shadow-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-status-critical-fg aria-invalid:shadow-[0_0_0_3px_var(--ps-status-critical-bg)]',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
      >
        <Icon name="check" size={14} data-slot="icon" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
