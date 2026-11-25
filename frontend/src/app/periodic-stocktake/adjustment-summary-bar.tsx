'use client'

import * as React from 'react'
import { Button, Icon } from '@/components/ui'
import { formatPersianNumber, formatRial } from '@/lib/persian'
import type { StocktakeCycle } from '@/lib/types/stocktake'
import { cn } from '@/lib/utils'

export type AdjustmentSummaryBarProps = {
  cycle: StocktakeCycle | null
  exporting: boolean
  confirming: boolean
  onExportCsv: () => void
  onOpenPrintPreview: () => void
  onOpenConfirmDialog: () => void
}

function formatNetRial(value: number): string {
  if (value === 0) return formatRial(0)
  const abs = formatRial(Math.abs(value))
  return value < 0 ? `${abs}-` : `${abs}+`
}

export function AdjustmentSummaryBar({
  cycle,
  exporting,
  confirming,
  onExportCsv,
  onOpenPrintPreview,
  onOpenConfirmDialog,
}: AdjustmentSummaryBarProps) {
  if (!cycle) return null

  const { summary } = cycle
  const isConfirmed = cycle.status === 'confirmed'
  const canConfirm = cycle.status === 'active' && summary.countedItems > 0

  return (
    <div
      data-slot="stocktake-summary-bar"
      className="sticky bottom-3 z-20 flex flex-col justify-between gap-4 rounded-default border border-border-default bg-surface/95 p-4 backdrop-blur-md lg:flex-row lg:items-center"
    >
      <div className="flex flex-wrap items-center gap-6">
        <div className="space-y-0.5">
          <div className="text-label-sm text-text-muted">اقلام ارزیابی‌شده</div>
          <div className="text-title-md font-bold text-text-primary tabular-nums-data">
            {formatPersianNumber(summary.countedItems)} از{' '}
            {formatPersianNumber(summary.totalItems)} قلم
          </div>
        </div>

        <div className="hidden h-8 w-px bg-border-subtle sm:block" aria-hidden />

        <div className="space-y-0.5">
          <div className="text-label-sm text-status-critical-fg">مجموع کسری کل</div>
          <div className="text-title-md font-bold text-status-critical-fg tabular-nums-data">
            {summary.shortageUnits > 0
              ? `${formatPersianNumber(summary.shortageUnits)}- واحد`
              : `${formatPersianNumber(0)} واحد`}
          </div>
        </div>

        <div className="hidden h-8 w-px bg-border-subtle sm:block" aria-hidden />

        <div className="space-y-0.5">
          <div className="text-label-sm text-status-valid-fg">مجموع مازاد کل</div>
          <div className="text-title-md font-bold text-status-valid-fg tabular-nums-data">
            {summary.surplusUnits > 0
              ? `${formatPersianNumber(summary.surplusUnits)}+ واحد`
              : `${formatPersianNumber(0)} واحد`}
          </div>
        </div>

        <div className="hidden h-8 w-px bg-border-subtle sm:block" aria-hidden />

        <div className="space-y-0.5">
          <div className="text-label-sm text-text-secondary">خالص اثر مالی مغایرت</div>
          <div
            className={cn(
              'text-headline-sm font-bold tabular-nums-data',
              summary.netVarianceRial < 0 && 'text-status-critical-fg',
              summary.netVarianceRial > 0 && 'text-status-valid-fg',
              summary.netVarianceRial === 0 && 'text-text-primary',
            )}
          >
            {formatNetRial(summary.netVarianceRial)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          loading={exporting}
          onClick={onExportCsv}
        >
          <Icon name="download" size={18} data-slot="icon" />
          خروجی اکسل (CSV)
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onOpenPrintPreview}
        >
          <Icon name="picture_as_pdf" size={18} data-slot="icon" />
          صورتجلسه چاپی / PDF
        </Button>

        <Button
          type="button"
          id="stocktake-confirm-btn"
          disabled={!canConfirm || isConfirmed}
          loading={confirming}
          onClick={onOpenConfirmDialog}
        >
          <Icon name="assignment_turned_in" size={18} data-slot="icon" />
          {isConfirmed
            ? `سند ${cycle.adjustmentDocNo ?? ''} صادر شد`
            : 'تایید نهایی و صدور سند تعدیل کاردکس'}
        </Button>
      </div>
    </div>
  )
}
