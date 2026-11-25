'use client'

import * as React from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  formatJalaliDate,
  formatPersianNumber,
  toPersianDigits,
} from '@/lib/persian'
import { parseNonNegativeCount } from '@/lib/stocktake/gating'
import {
  VARIANCE_REASON_PRESETS,
  type StocktakeCycle,
  type StocktakeItem,
} from '@/lib/types/stocktake'

export type LiveCountTerminalProps = {
  cycle: StocktakeCycle | null
  activeItem: StocktakeItem | null
  scannerQuery: string
  onScannerQueryChange: (value: string) => void
  onScannerSubmit: () => void
  countInput: string
  onCountInputChange: (value: string) => void
  reasonInput: string
  onReasonInputChange: (value: string) => void
  submitting: boolean
  onSubmitCount: () => void
  onSkipItem: () => void
}

export function LiveCountTerminal({
  cycle,
  activeItem,
  scannerQuery,
  onScannerQueryChange,
  onScannerSubmit,
  countInput,
  onCountInputChange,
  reasonInput,
  onReasonInputChange,
  submitting,
  onSubmitCount,
  onSkipItem,
}: LiveCountTerminalProps) {
  const isEditable = cycle?.status === 'active' && activeItem != null
  const parsedCount = parseNonNegativeCount(countInput)
  const isBlindPending =
    cycle?.method === 'blind' &&
    cycle.status === 'active' &&
    activeItem?.countStatus !== 'counted'

  const handleStep = (delta: number) => {
    const base = parsedCount ?? 0
    const next = Math.max(0, base + delta)
    onCountInputChange(toPersianDigits(next))
  }

  const handleCountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isEditable && !submitting) {
      e.preventDefault()
      onSubmitCount()
    }
  }

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onScannerSubmit()
    }
  }

  const progressPct = cycle?.summary.progressPct ?? 0

  return (
    <Card className="lg:col-span-7" data-slot="stocktake-live-terminal">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Icon
            name="barcode_scanner"
            size={22}
            className="text-primary"
            data-slot="icon"
          />
          <CardTitle className="text-title-md">
            ورود داده‌های زنده و شمارش سریع قفسه
          </CardTitle>
        </div>
        <div className="flex items-center gap-2 text-label-sm text-text-secondary">
          <span className="size-2 rounded-full bg-status-valid-fg" aria-hidden />
          <span>اتصال بارکدخوان: آماده</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Icon
              name="qr_code_scanner"
              size={18}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted"
              data-slot="icon"
            />
            <Input
              id="stocktake-scanner-input"
              value={scannerQuery}
              onChange={(e) => onScannerQueryChange(e.target.value)}
              onKeyDown={handleScannerKeyDown}
              placeholder="اسکن بارکد GTIN، کد ژنریک، سری ساخت یا نام دارو (Enter)…"
              className="ps-9"
              disabled={!cycle}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={onScannerSubmit}
            disabled={!cycle || !scannerQuery.trim()}
          >
            جستجو و انتخاب قلم
          </Button>
        </div>

        {activeItem ? (
          <>
            <div
              data-slot="stocktake-active-item-card"
              className="space-y-2 rounded-default border border-border-subtle bg-surface-subtle p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {activeItem.genericCode ? (
                    <Badge variant="outline" className="tabular-nums-data">
                      کد ژنریک: {activeItem.genericCode}
                    </Badge>
                  ) : null}
                  {activeItem.gtin ? (
                    <Badge
                      variant="outline"
                      dir="ltr"
                      className="font-latin tabular-nums-data"
                    >
                      GTIN: {activeItem.gtin}
                    </Badge>
                  ) : null}
                  <Badge variant={activeItem.isControlled ? 'critical' : 'secondary'}>
                    {activeItem.isControlled ? 'داروی تحت کنترل' : 'داروی ژنریک'}
                  </Badge>
                </div>
                <span className="text-body-sm text-text-muted tabular-nums-data">
                  سری ساخت: <strong className="font-latin text-text-primary">{activeItem.batchNo}</strong>
                </span>
              </div>

              <div className="flex flex-col justify-between gap-1 pt-1 sm:flex-row sm:items-baseline">
                <div className="text-headline-sm text-text-primary">
                  {activeItem.nameFa}
                </div>
                {activeItem.nameEn ? (
                  <div className="font-latin text-body-sm text-text-secondary" dir="ltr">
                    {activeItem.nameEn}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-body-sm text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Icon name="location_on" size={16} className="text-text-muted" data-slot="icon" />
                  محل استقرار فیزیکی:{' '}
                  <strong className="font-medium text-text-primary">
                    {activeItem.locationLabel || activeItem.zone}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="event" size={16} className="text-text-muted" data-slot="icon" />
                  تاریخ انقضا:{' '}
                  <strong className="font-medium text-text-primary tabular-nums-data">
                    {formatJalaliDate(activeItem.expiry)}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="inventory_2" size={16} className="text-text-muted" data-slot="icon" />
                  موجودی سیستم:{' '}
                  {isBlindPending || activeItem.systemQty == null ? (
                    <Badge variant="outline">پنهان در شمارش کور</Badge>
                  ) : (
                    <strong className="font-bold text-primary tabular-nums-data">
                      {formatPersianNumber(activeItem.systemQty)} {activeItem.unitLabel}
                    </strong>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stocktake-count-input">
                تعداد شمارش‌شده در قفسه فعلی ({activeItem.unitLabel})
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="کاهش تعداد"
                  className="h-14 w-14 shrink-0"
                  disabled={!isEditable || submitting || (parsedCount ?? 0) <= 0}
                  onClick={() => handleStep(-1)}
                >
                  <Icon name="remove" size={24} data-slot="icon" />
                </Button>

                <div className="relative flex-1">
                  <Input
                    id="stocktake-count-input"
                    value={countInput}
                    onChange={(e) => onCountInputChange(e.target.value)}
                    onKeyDown={handleCountKeyDown}
                    disabled={!isEditable || submitting}
                    placeholder="۰"
                    inputMode="numeric"
                    className="h-14 text-center text-headline-lg font-bold text-primary tabular-nums-data"
                  />
                  <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-label-md text-text-muted">
                    {activeItem.unitLabel}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  aria-label="افزایش تعداد"
                  className="h-14 w-14 shrink-0"
                  disabled={!isEditable || submitting}
                  onClick={() => handleStep(1)}
                >
                  <Icon name="add" size={24} data-slot="icon" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-label-sm text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <Icon name="keyboard_return" size={15} data-slot="icon" />
                  کلید میانبر: دکمه Enter برای ثبت و انتقال خودکار به قلم بعدی
                </span>
                <span>واحد سنجش: {activeItem.unitLabel}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="stocktake-reason-preset" className="text-label-sm">
                  علت احتمالی مغایرت (اختیاری)
                </Label>
                <Select
                  value={
                    VARIANCE_REASON_PRESETS.includes(reasonInput)
                      ? reasonInput
                      : ''
                  }
                  onValueChange={(v) => onReasonInputChange(v)}
                  disabled={!isEditable}
                >
                  <SelectTrigger id="stocktake-reason-preset">
                    <SelectValue placeholder="انتخاب علت استاندارد…" />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANCE_REASON_PRESETS.map((preset) => (
                      <SelectItem key={preset} value={preset}>
                        {preset}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="stocktake-reason-input" className="text-label-sm">
                  توضیح تکمیلی بازرس
                </Label>
                <Input
                  id="stocktake-reason-input"
                  value={reasonInput}
                  onChange={(e) => onReasonInputChange(e.target.value)}
                  disabled={!isEditable}
                  placeholder="مثلاً شکستگی حین جابجایی..."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                id="stocktake-submit-count"
                className="h-11 flex-1"
                disabled={!isEditable || parsedCount === null}
                loading={submitting}
                onClick={onSubmitCount}
              >
                <Icon name="save" size={20} data-slot="icon" />
                ثبت شمارش و ادامه به داروی بعدی
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={!isEditable || submitting}
                onClick={onSkipItem}
              >
                <Icon name="skip_next" size={20} data-slot="icon" />
                رد قلم (نامشخص)
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-default border border-dashed border-border-default bg-surface-subtle p-6 text-center text-body-sm text-text-secondary">
            {cycle
              ? 'ردیفی برای شمارش انتخاب نشده است. از جدول پایین یک قلم را انتخاب کنید.'
              : 'برای شروع شمارش، یک دوره فعال را انتخاب کنید یا دوره جدیدی بسازید.'}
          </div>
        )}

        <div className="space-y-1.5 rounded-default bg-surface-subtle p-3">
          <div className="flex items-center justify-between text-label-sm">
            <span className="text-text-secondary">
              پیشرفت شمارش در {cycle?.zoneLabel ?? 'بخش انتخابی'}
            </span>
            <span className="font-medium text-primary tabular-nums-data">
              {formatPersianNumber(cycle?.summary.countedItems ?? 0)} از{' '}
              {formatPersianNumber(cycle?.summary.totalItems ?? 0)} قلم (
              {toPersianDigits(progressPct.toFixed(1))}٪)
            </span>
          </div>
          <Progress
            value={progressPct}
            aria-label="پیشرفت شمارش انبارگردانی"
          />
        </div>
      </CardContent>
    </Card>
  )
}
