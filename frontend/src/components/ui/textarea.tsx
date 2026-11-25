import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const textareaVariants = cva(
  [
    'flex field-sizing-content min-h-16 w-full rounded-default border bg-surface px-3 py-2',
    'text-body-md text-text-primary transition-[color,box-shadow,border-color]',
    'outline-none placeholder:text-text-placeholder',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
    'focus-visible:border-primary focus-visible:shadow-focus',
  ].join(' '),
  {
    variants: {
      state: {
        default: 'border-border-default hover:border-border-strong',
        error:
          'border-status-critical-fg focus-visible:border-status-critical-fg focus-visible:shadow-[0_0_0_3px_var(--ps-status-critical-bg)]',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  },
)

type TextareaProps = React.ComponentProps<'textarea'> &
  VariantProps<typeof textareaVariants> & {
    error?: boolean
  }

function Textarea({
  className,
  state,
  error,
  'aria-invalid': ariaInvalid,
  ...props
}: TextareaProps) {
  const resolvedState = error || ariaInvalid ? 'error' : state

  return (
    <textarea
      data-slot="textarea"
      data-state={resolvedState ?? 'default'}
      aria-invalid={error || ariaInvalid ? true : undefined}
      className={cn(textareaVariants({ state: resolvedState }), className)}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
export type { TextareaProps }
