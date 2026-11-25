import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import type { IconName } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { TriageStatus } from './triage-status-badge'

const TONE_ICON_SURFACE: Record<TriageStatus | 'primary', string> = {
  primary: 'bg-primary-tint text-primary',
  valid: 'bg-status-valid-bg text-status-valid-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  expiring: 'bg-status-expiring-bg text-status-expiring-fg',
  critical: 'bg-status-critical-bg text-status-critical-fg',
  info: 'bg-status-info-bg text-status-info-fg',
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
}

const DELTA_ICON = {
  up: 'arrow_upward',
  down: 'arrow_downward',
  flat: 'remove',
} as const satisfies Record<string, IconName>

export type KpiMetricCardProps = React.ComponentProps<'div'> & {
  title: string
  value: React.ReactNode
  icon?: IconName
  tone?: TriageStatus | 'primary'
  description?: string
  delta?: {
    label: string
    direction?: 'up' | 'down' | 'flat'
  }
}

/**
 * Soft-border KPI summary card (no drop shadow; DESIGN.md / design-system-spec).
 * Value uses tabular nums for inventory scannability.
 */
function KpiMetricCard({
  title,
  value,
  icon = 'analytics',
  tone = 'primary',
  description,
  delta,
  className,
  ...props
}: KpiMetricCardProps) {
  return (
    <Card
      data-slot="kpi-metric-card"
      data-tone={tone}
      className={cn('min-w-0 gap-3 overflow-hidden p-5', className)}
      {...props}
    >
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] gap-3 p-0">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-title-sm text-text-secondary">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-label-sm">{description}</CardDescription>
          ) : null}
        </div>
        <span
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-default',
            TONE_ICON_SURFACE[tone],
          )}
          aria-hidden
        >
          <Icon name={icon} size={20} data-slot="icon" />
        </span>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-2 p-0">
        <div className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] text-kpi tabular-nums-data text-text-primary">
          {value}
        </div>
        {delta ? (
          <p
            data-slot="kpi-delta"
            data-direction={delta.direction ?? 'flat'}
            className="inline-flex min-w-0 items-center gap-1 text-label-md text-text-secondary"
          >
            <Icon
              name={DELTA_ICON[delta.direction ?? 'flat']}
              size={14}
              className="shrink-0"
              data-slot="icon"
            />
            <span className="min-w-0 break-words">{delta.label}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { KpiMetricCard }
