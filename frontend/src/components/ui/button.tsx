import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2',
    'rounded-default text-body-md font-medium whitespace-nowrap',
    'transition-[color,background-color,border-color,box-shadow,opacity]',
    'outline-none focus-visible:border-primary focus-visible:shadow-focus',
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-invalid:border-status-critical-border aria-invalid:shadow-[0_0_0_3px_var(--ps-status-critical-bg)]',
    'active:translate-y-px',
    '[&_[data-slot=icon]]:pointer-events-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        destructive:
          'bg-status-critical-fg text-destructive-foreground hover:bg-status-critical-fg/90 focus-visible:border-status-critical-fg focus-visible:shadow-[0_0_0_3px_var(--ps-status-critical-bg)]',
        outline:
          'border border-border-default bg-surface text-text-primary hover:bg-surface-hover hover:border-border-strong',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary',
        ghost: 'bg-transparent text-text-primary hover:bg-surface-hover',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 gap-1.5 px-3 text-body-sm',
        lg: 'h-10 px-6 text-body-lg',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  const isDisabled = Boolean(disabled || loading)

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : isDisabled}
      aria-disabled={asChild ? (isDisabled ? true : undefined) : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? (
            <Icon
              name="progress_activity"
              size={16}
              className="animate-spin"
              data-slot="icon"
            />
          ) : null}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
