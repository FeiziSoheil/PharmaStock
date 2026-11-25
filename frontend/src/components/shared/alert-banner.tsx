import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { STATUS_ICON_MAP } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { TriageStatus } from './triage-status-badge'

const TONE_STYLES: Record<TriageStatus, string> = {
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
}

export type AlertBannerProps = React.ComponentProps<'div'> & {
  tone?: TriageStatus
  title: string
  description?: string
  action?: React.ReactNode
  onDismiss?: () => void
}

/**
 * Inline page-level alert strip (not a toast). Uses triage status tokens.
 */
function AlertBanner({
  tone = 'info',
  title,
  description,
  action,
  onDismiss,
  className,
  ...props
}: AlertBannerProps) {
  return (
    <div
      role="status"
      data-slot="alert-banner"
      data-tone={tone}
      className={cn(
        'flex items-start gap-3 rounded-default border px-4 py-3',
        TONE_STYLES[tone],
        className,
      )}
      {...props}
    >
      <Icon
        name={STATUS_ICON_MAP[tone]}
        size={20}
        className="mt-0.5"
        data-slot="icon"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-title-sm text-current">{title}</p>
        {description ? (
          <p className="text-body-sm opacity-90">{description}</p>
        ) : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="بستن اعلان"
          className="text-current hover:bg-transparent"
          onClick={onDismiss}
        >
          <Icon name="close" size={16} data-slot="icon" />
        </Button>
      ) : null}
    </div>
  )
}

export { AlertBanner }
