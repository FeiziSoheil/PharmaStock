import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  [
    'flex h-9 w-full min-w-0 rounded-default border bg-surface px-3 py-1',
    'text-body-md text-text-primary transition-[color,box-shadow,border-color]',
    'outline-none placeholder:text-text-placeholder',
    'selection:bg-primary selection:text-primary-foreground',
    'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-text-primary',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
    'focus-visible:border-primary focus-visible:shadow-focus',
  ].join(' '),
  {
    variants: {
      state: {
        default: 'border-border-default hover:border-border-strong',
        error:
          'border-status-critical-fg aria-invalid:border-status-critical-fg focus-visible:border-status-critical-fg focus-visible:shadow-[0_0_0_3px_var(--ps-status-critical-bg)]',
      },
      size: {
        default: 'h-9 text-body-md',
        sm: 'h-8 text-body-sm',
        lg: 'h-10 text-body-lg',
      },
    },
    defaultVariants: {
      state: 'default',
      size: 'default',
    },
  },
)

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  VariantProps<typeof inputVariants> & {
    error?: boolean
  }

function Input({
  className,
  type = 'text',
  state,
  size,
  error,
  'aria-invalid': ariaInvalid,
  ...props
}: InputProps) {
  const resolvedState = error || ariaInvalid ? 'error' : state

  return (
    <input
      type={type}
      data-slot="input"
      data-size={size ?? 'default'}
      data-state={resolvedState ?? 'default'}
      aria-invalid={error || ariaInvalid ? true : undefined}
      className={cn(inputVariants({ state: resolvedState, size }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
export type { InputProps }
