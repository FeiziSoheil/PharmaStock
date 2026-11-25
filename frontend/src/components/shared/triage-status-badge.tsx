import * as React from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { STATUS_ICON_MAP } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type TriageStatus =
  | 'valid'
  | 'warning'
  | 'expiring'
  | 'critical'
  | 'info'
  | 'neutral'

const DEFAULT_LABELS: Record<TriageStatus, string> = {
  valid: 'موجود',
  warning: 'موجودی کم',
  expiring: 'نزدیک انقضا',
  critical: 'بحرانی',
  info: 'اطلاع',
  neutral: 'عادی',
}

export type TriageStatusBadgeProps = Omit<BadgeProps, 'variant'> & {
  status: TriageStatus
  /** Hide the status icon (text-only chip). */
  hideIcon?: boolean
}

/**
 * Inventory triage chip — Stitch status colors via Badge variants + Material Symbol.
 * Always pairs color with Persian label (and icon by default).
 */
function TriageStatusBadge({
  status,
  hideIcon = false,
  className,
  children,
  ...props
}: TriageStatusBadgeProps) {
  const label = children ?? DEFAULT_LABELS[status]

  return (
    <Badge
      data-slot="triage-status-badge"
      data-status={status}
      variant={status}
      className={cn(className)}
      {...props}
    >
      {hideIcon ? null : (
        <Icon name={STATUS_ICON_MAP[status]} size={14} data-slot="icon" />
      )}
      {label}
    </Badge>
  )
}

export { TriageStatusBadge, DEFAULT_LABELS as TRIAGE_STATUS_LABELS }
