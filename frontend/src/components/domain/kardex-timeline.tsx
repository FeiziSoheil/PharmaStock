import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import type { IconName } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type KardexTone = 'neutral' | 'inbound' | 'outbound' | 'alert' | 'primary'

export type KardexTimelineItem = {
  id: string
  title: string
  description?: string
  /** Display string, already formatted */
  timestamp: string
  /** Actor / system note */
  meta?: string
  tone?: KardexTone
  /** Material Symbol name */
  icon?: string
  /** e.g. "+۵۰۰" */
  deltaIn?: string
  deltaOut?: string
  balance?: string
}

export type KardexTimelineProps = {
  items: KardexTimelineItem[]
  emptyLabel?: string
  className?: string
}

/**
 * Tone map mirrors Stitch dashboard Activity Timeline markers + drug-details-cardex
 * event chips. Stitch `tertiary` (inbound) → Phase B `secondary` (clinical teal).
 * Stitch `error` (alert / outbound qty) → `status-critical-*`.
 */
const TONE_STYLES: Record<
  KardexTone,
  {
    marker: string
    title: string
    card: string
    iconWrap: string
    meta: string
  }
> = {
  primary: {
    marker: 'bg-primary',
    title: 'text-primary',
    card: 'bg-surface-subtle',
    iconWrap: 'bg-primary-tint text-primary',
    meta: 'text-text-secondary',
  },
  inbound: {
    marker: 'bg-secondary',
    title: 'text-secondary',
    card: 'bg-surface-subtle',
    iconWrap: 'bg-secondary-tint text-secondary',
    meta: 'text-text-secondary',
  },
  outbound: {
    marker: 'bg-secondary',
    title: 'text-secondary',
    card: 'bg-surface-subtle',
    iconWrap: 'bg-status-critical-bg text-status-critical-fg',
    meta: 'text-text-secondary',
  },
  alert: {
    marker: 'bg-status-critical-fg',
    title: 'text-status-critical-fg',
    card: 'bg-status-critical-bg',
    iconWrap: 'bg-status-critical-bg text-status-critical-fg',
    meta: 'text-status-critical-fg',
  },
  neutral: {
    marker: 'bg-status-neutral-fg',
    title: 'text-text-primary',
    card: 'bg-surface-subtle',
    iconWrap: 'bg-status-neutral-bg text-status-neutral-fg',
    meta: 'text-text-secondary',
  },
}

const DEFAULT_EMPTY = 'رویدادی ثبت نشده است'

/**
 * RTL-native kardex / activity timeline. Vertical rail sits on inline-start
 * (physical right in RTL). Presentational only — events via props.
 */
function KardexTimeline({
  items,
  emptyLabel = DEFAULT_EMPTY,
  className,
}: KardexTimelineProps) {
  if (items.length === 0) {
    return (
      <div
        data-slot="kardex-timeline"
        role="status"
        className={cn(
          'w-full rounded-default border border-border-default bg-surface-subtle px-space-md py-space-lg text-center text-body-sm text-text-secondary',
          className,
        )}
      >
        {emptyLabel}
      </div>
    )
  }

  return (
    <div
      data-slot="kardex-timeline"
      className={cn('relative w-full', className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute start-[7px] top-2 bottom-2 w-0.5 bg-border-default"
      />
      <ol
        aria-label="کاردکس رویدادها"
        className="relative w-full space-y-space-md ps-4"
      >
        {items.map((item) => {
          const tone = item.tone ?? 'neutral'
          const styles = TONE_STYLES[tone]
          const hasDeltas = Boolean(item.deltaIn || item.deltaOut || item.balance)

          return (
            <li
              key={item.id}
              data-tone={tone}
              className="relative flex items-start gap-space-sm"
            >
              <span
                aria-hidden
                className={cn(
                  'z-10 mt-1 flex size-4 shrink-0 -ms-[13px] items-center justify-center rounded-full border border-border-default',
                  styles.marker,
                )}
              >
                <span className="size-1.5 rounded-full bg-surface" />
              </span>

              <div
                className={cn(
                  'min-w-0 w-full rounded-default p-space-sm',
                  styles.card,
                )}
              >
                <div className="mb-1 flex flex-col gap-1 tablet:flex-row tablet:items-center tablet:justify-between">
                  <div className="flex min-w-0 items-start gap-2">
                    {item.icon ? (
                      <span
                        className={cn(
                          'inline-flex size-7 shrink-0 items-center justify-center rounded-inner',
                          styles.iconWrap,
                        )}
                      >
                        <Icon
                          name={item.icon as IconName}
                          size={16}
                          data-slot="icon"
                        />
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'text-label-md font-bold',
                        styles.title,
                      )}
                    >
                      {item.title}
                    </span>
                  </div>
                  <time className="shrink-0 text-label-sm text-text-secondary tabular-nums-data">
                    {item.timestamp}
                  </time>
                </div>

                {item.description ? (
                  <p className="text-body-sm text-text-primary">
                    {item.description}
                  </p>
                ) : null}

                {hasDeltas ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.deltaIn ? (
                      <span className="text-label-md font-bold text-secondary tabular-nums-data">
                        {item.deltaIn}
                      </span>
                    ) : null}
                    {item.deltaOut ? (
                      <span className="text-label-md font-bold text-status-critical-fg tabular-nums-data">
                        {item.deltaOut}
                      </span>
                    ) : null}
                    {item.balance ? (
                      <Badge variant="neutral" className="tabular-nums-data">
                        مانده: {item.balance}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}

                {item.meta ? (
                  <div
                    className={cn(
                      'mt-2 text-[11px] font-medium',
                      styles.meta,
                    )}
                  >
                    {item.meta}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export { KardexTimeline }
