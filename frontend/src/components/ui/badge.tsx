import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1.5',
    'rounded-badge border px-2.5 py-1 text-label-md font-medium whitespace-nowrap',
    'transition-[color,background-color,border-color,box-shadow]',
    'outline-none focus-visible:border-primary focus-visible:shadow-focus',
    '[&_[data-slot=icon]]:pointer-events-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-surface-subtle text-text-primary',
        outline: 'border-border-default bg-surface text-text-primary',
        valid:
          'border-status-valid-border bg-status-valid-bg text-status-valid-fg',
        warning:
          'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
        expiring:
          'border-status-expiring-border bg-status-expiring-bg text-status-expiring-fg',
        critical:
          'border-status-critical-border bg-status-critical-bg text-status-critical-fg',
        info: 'border-status-info-border bg-status-info-bg text-status-info-fg',
        neutral:
          'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
  }

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
