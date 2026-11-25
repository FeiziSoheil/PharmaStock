'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import type { IconName } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type ConfirmDialogTone = 'warning' | 'critical' | 'info'

const TONE_CONFIG: Record<
  ConfirmDialogTone,
  { icon: IconName; surface: string; buttonVariant: 'default' | 'destructive' }
> = {
  warning: {
    icon: 'warning',
    surface: 'bg-status-warning-bg text-status-warning-fg',
    buttonVariant: 'default',
  },
  critical: {
    icon: 'dangerous',
    surface: 'bg-status-critical-bg text-status-critical-fg',
    buttonVariant: 'destructive',
  },
  info: {
    icon: 'info',
    surface: 'bg-status-info-bg text-status-info-fg',
    buttonVariant: 'default',
  },
}

export type ConfirmDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  /** Plain text or rich summary content (e.g. multi-line order breakdown). */
  description?: React.ReactNode
  tone?: ConfirmDialogTone
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
  loading?: boolean
  trigger?: React.ReactNode
  className?: string
}

/**
 * Critical-action confirm dialog (420px token width via DialogContent).
 * Warning icon circle + confirm / cancel actions per design-system-spec.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  tone = 'warning',
  confirmLabel = 'تأیید و ثبت',
  cancelLabel = 'انصراف',
  onConfirm,
  onCancel,
  loading = false,
  trigger,
  className,
}: ConfirmDialogProps) {
  const config = TONE_CONFIG[tone]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        data-pattern="confirm-dialog"
        data-tone={tone}
        showCloseButton={false}
        className={cn('sm:max-w-[var(--ps-confirm-dialog-width)]', className)}
      >
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <span
            className={cn(
              'mb-2 inline-flex size-12 items-center justify-center rounded-full',
              config.surface,
            )}
            aria-hidden
          >
            <Icon name={config.icon} size={24} data-slot="icon" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            typeof description === 'string' ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription asChild>
                <div className="text-body-sm text-text-secondary">{description}</div>
              </DialogDescription>
            )
          ) : null}
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              onCancel?.()
              onOpenChange?.(false)
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            loading={loading}
            onClick={() => {
              onConfirm?.()
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
