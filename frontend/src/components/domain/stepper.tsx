'use client'

import * as React from 'react'
import { Icon } from '@/components/ui/icon'
import type { IconName } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type StepStatus = 'completed' | 'current' | 'upcoming'

export type StepperStep = {
  id: string
  /** e.g. عنوان گام */
  label: string
  description?: string
  /** e.g. "گام ۱ • پایان‌یافته" */
  meta?: string
  status: StepStatus
  /** Material Symbol name optional; completed defaults to check */
  icon?: string
}

export type StepperProps = {
  steps: StepperStep[]
  /** optional override; otherwise first status=current */
  currentStepId?: string
  /** only for completed/current if clickable */
  onStepSelect?: (stepId: string) => void
  className?: string
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const

function toPersianDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit)
}

function resolveEffectiveStatus(
  step: StepperStep,
  currentStepId?: string,
): StepStatus {
  if (!currentStepId) return step.status
  if (step.id === currentStepId) return 'current'
  if (step.status === 'current') return 'upcoming'
  return step.status
}

const STEP_CARD: Record<StepStatus, string> = {
  completed: 'bg-surface-subtle',
  current: 'bg-primary-tint',
  upcoming: 'bg-surface-subtle opacity-60',
}

const STEP_ICON: Record<StepStatus, string> = {
  completed: 'bg-status-valid-fg text-text-inverse',
  current: 'bg-primary text-primary-foreground',
  upcoming: 'bg-surface-muted text-text-muted',
}

const STEP_META: Record<StepStatus, string> = {
  completed: 'text-status-valid-fg font-bold',
  current: 'text-primary font-bold',
  upcoming: 'text-text-muted font-medium',
}

const STEP_LABEL: Record<StepStatus, string> = {
  completed: 'text-text-primary',
  current: 'text-primary font-bold',
  upcoming: 'text-text-muted',
}

const STEP_DESCRIPTION: Record<StepStatus, string> = {
  completed: 'text-text-secondary',
  current: 'text-text-secondary',
  upcoming: 'text-text-muted',
}

const STEP_DOT: Record<Exclude<StepStatus, 'upcoming'>, string> = {
  completed: 'bg-status-valid-fg',
  current: 'bg-primary animate-pulse',
}

/**
 * Multi-step progress indicator (Stitch invoice-receipts pattern).
 * RTL-native; stacks on mobile, 3-column on md+.
 */
function Stepper({
  steps,
  currentStepId,
  onStepSelect,
  className,
}: StepperProps) {
  const activeId =
    currentStepId ?? steps.find((step) => step.status === 'current')?.id

  return (
    <nav
      data-slot="stepper"
      aria-label="مراحل"
      className={cn(
        'rounded-default border border-border-default bg-surface p-space-md shadow-none',
        className,
      )}
    >
      <ol className="relative grid grid-cols-1 gap-space-md md:grid-cols-3">
        {steps.map((step, index) => {
          const status = resolveEffectiveStatus(step, currentStepId)
          const isCurrent = step.id === activeId
          const clickable =
            Boolean(onStepSelect) &&
            (status === 'completed' || status === 'current')
          const stepNumber = index + 1
          const showCheck = status === 'completed'
          const iconName = (step.icon ?? (showCheck ? 'check' : undefined)) as
            | IconName
            | undefined

          const inner = (
            <>
              <span
                className={cn(
                  'inline-flex size-10 shrink-0 items-center justify-center rounded-default',
                  STEP_ICON[status],
                )}
                aria-hidden
              >
                {iconName ? (
                  <Icon name={iconName} size={20} data-slot="icon" />
                ) : (
                  <span className="text-data-tabular tabular-nums-data">
                    {toPersianDigits(stepNumber)}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                {step.meta ? (
                  <span className="flex items-center gap-space-xs">
                    <span
                      className={cn('text-label-sm', STEP_META[status])}
                    >
                      {step.meta}
                    </span>
                    {status !== 'upcoming' ? (
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          STEP_DOT[status],
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'truncate text-title-md',
                    STEP_LABEL[status],
                  )}
                >
                  {step.label}
                </span>
                {step.description ? (
                  <span
                    className={cn(
                      'truncate text-body-sm',
                      STEP_DESCRIPTION[status],
                    )}
                  >
                    {step.description}
                  </span>
                ) : null}
              </span>
            </>
          )

          const cardClass = cn(
            'flex w-full items-center gap-space-sm rounded-default p-space-sm text-start transition-all',
            STEP_CARD[status],
            clickable &&
              'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )

          return (
            <li
              key={step.id}
              data-status={status}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {clickable ? (
                <button
                  type="button"
                  className={cardClass}
                  onClick={() => onStepSelect?.(step.id)}
                >
                  {inner}
                </button>
              ) : (
                <div className={cardClass}>{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Stepper }
