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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { formatPersianNumber } from '@/lib/persian'
import {
  STOCKTAKE_ZONE_OPTIONS,
  type StocktakeCycle,
  type StocktakeCycleListItem,
  type StocktakeMethod,
  type StocktakeZoneOption,
} from '@/lib/types/stocktake'
import { cn } from '@/lib/utils'

export type CycleSetupCardProps = {
  cycle: StocktakeCycle | null
  cycles: StocktakeCycleListItem[]
  selectedZone: StocktakeZoneOption
  onZoneChange: (zone: StocktakeZoneOption) => void
  selectedMethod: StocktakeMethod
  onMethodChange: (method: StocktakeMethod) => void
  counterName: string
  onCounterNameChange: (value: string) => void
  supervisorName: string
  onSupervisorNameChange: (value: string) => void
  creating: boolean
  savingSettings: boolean
  onCreateCycle: () => void
  onSaveSettings: () => void
  onSelectCycle: (cycleId: string) => void
}

export function CycleSetupCard({
  cycle,
  cycles,
  selectedZone,
  onZoneChange,
  selectedMethod,
  onMethodChange,
  counterName,
  onCounterNameChange,
  supervisorName,
  onSupervisorNameChange,
  creating,
  savingSettings,
  onCreateCycle,
  onSaveSettings,
  onSelectCycle,
}: CycleSetupCardProps) {
  const isActive = cycle?.status === 'active'
  const settingsChanged =
    Boolean(cycle) &&
    isActive &&
    (selectedMethod !== cycle?.method ||
      counterName.trim() !== cycle?.counterName ||
      supervisorName.trim() !== cycle?.supervisorName)

  return (
    <Card className="lg:col-span-5" data-slot="stocktake-setup-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Icon name="tune" size={22} className="text-primary" data-slot="icon" />
          <CardTitle className="text-title-md">تنظیم و هدایت دوره شمارش</CardTitle>
        </div>
        <Badge variant="outline">پیکربندی</Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="stocktake-zone-select">
            انتخاب سالن / بخش فیزیکی داروخانه
          </Label>
          <Select
            value={selectedZone}
            onValueChange={(value) => onZoneChange(value as StocktakeZoneOption)}
          >
            <SelectTrigger id="stocktake-zone-select" className="w-full">
              <SelectValue placeholder="انتخاب بخش انبار" />
            </SelectTrigger>
            <SelectContent>
              {STOCKTAKE_ZONE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-label-md font-medium text-text-primary">
            روش شمارش و متدولوژی حسابرسی
          </legend>
          <div className="grid grid-cols-1 gap-2">
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-default border p-3 transition-colors',
                selectedMethod === 'blind'
                  ? 'border-primary bg-primary-tint/40'
                  : 'border-border-subtle bg-surface-subtle hover:bg-surface-hover',
              )}
            >
              <input
                type="radio"
                name="stocktake_method"
                value="blind"
                checked={selectedMethod === 'blind'}
                onChange={() => onMethodChange('blind')}
                className="mt-1 size-4 accent-[var(--ps-primary)]"
              />
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-label-lg text-text-primary">
                    شمارش کور (Blind Count)
                  </span>
                  <Badge variant="default">پیشنهاد استاندارد GMP</Badge>
                </div>
                <p className="text-body-sm text-text-secondary">
                  پنهان‌سازی موجودی سیستمی از انباردار حین ثبت، برای ممانعت از سوگیری ذهنی و کشف خطای انسانی.
                </p>
              </div>
            </label>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-default border p-3 transition-colors',
                selectedMethod === 'open'
                  ? 'border-primary bg-primary-tint/40'
                  : 'border-border-subtle bg-surface-subtle hover:bg-surface-hover',
              )}
            >
              <input
                type="radio"
                name="stocktake_method"
                value="open"
                checked={selectedMethod === 'open'}
                onChange={() => onMethodChange('open')}
                className="mt-1 size-4 accent-[var(--ps-primary)]"
              />
              <div className="space-y-0.5">
                <span className="text-label-lg text-text-primary">
                  شمارش آشکار (Open Count)
                </span>
                <p className="text-body-sm text-text-secondary">
                  نمایش موجودی کاردکس نرم‌افزار به شمارش‌گر برای انطباق سریع در اقلام غیرحیاتی.
                </p>
              </div>
            </label>
          </div>
        </fieldset>

        <div className="space-y-2 rounded-default border border-border-subtle bg-surface-subtle p-3">
          <div className="text-label-sm text-text-muted">تیم بازرسی مسئول</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="stocktake-counter-name" className="text-label-sm">
                شمارش‌گر ارشد انبار
              </Label>
              <Input
                id="stocktake-counter-name"
                value={counterName}
                onChange={(e) => onCounterNameChange(e.target.value)}
                disabled={Boolean(cycle && !isActive)}
                placeholder="مرتضی کاظمی"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stocktake-supervisor-name" className="text-label-sm">
                ناظر فنی داروساز
              </Label>
              <Input
                id="stocktake-supervisor-name"
                value={supervisorName}
                onChange={(e) => onSupervisorNameChange(e.target.value)}
                disabled={Boolean(cycle && !isActive)}
                placeholder="دکتر رضایی"
              />
            </div>
          </div>
          {settingsChanged ? (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={savingSettings}
                onClick={onSaveSettings}
              >
                <Icon name="save" size={16} data-slot="icon" />
                اعمال تغییرات تنظیمات دوره جاری
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            className="flex-1"
            loading={creating}
            onClick={onCreateCycle}
          >
            <Icon name="play_arrow" size={20} data-slot="icon" />
            شروع دوره جدید
          </Button>
          {cycles.length > 0 ? (
            <Select
              value={cycle?.id ?? ''}
              onValueChange={(value) => {
                if (value) onSelectCycle(value)
              }}
            >
              <SelectTrigger
                aria-label="انتخاب یا ادامه دوره انبارگردانی"
                className="w-full sm:w-56"
              >
                <SelectValue placeholder="انتخاب دوره موجود…" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.cycleCode} ({c.status === 'confirmed' ? 'تاییدشده' : 'فعال'} •{' '}
                    {formatPersianNumber(c.summary.countedItems)}/
                    {formatPersianNumber(c.summary.totalItems)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
