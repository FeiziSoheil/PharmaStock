'use client'

import * as React from 'react'
import {
  Badge,
  Button,
  Icon,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
} from '@/components/ui'
import { SideDrawer } from '@/components/shared'
import {
  DEFAULT_REORDER_FORMULA,
  type ReorderFormulaConfig,
  type ReorderFormulaMode,
} from '@/lib/types/reorder'
import { toPersianDigits } from '@/lib/persian'
import { cn } from '@/lib/utils'

type RopSettingsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialConfig: ReorderFormulaConfig
  saving?: boolean
  onSave: (cfg: ReorderFormulaConfig) => Promise<void>
}

function parseIntField(raw: string, fallback: number): number {
  const latin = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - '۰'.charCodeAt(0)))
  const n = Number(latin)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export function RopSettingsDrawer({
  open,
  onOpenChange,
  initialConfig,
  saving = false,
  onSave,
}: RopSettingsDrawerProps) {
  const [draft, setDraft] = React.useState<ReorderFormulaConfig>(initialConfig)
  const [error, setError] = React.useState<string | null>(null)
  const [snapshot, setSnapshot] = React.useState({ open, initialConfig })

  if (open !== snapshot.open || initialConfig !== snapshot.initialConfig) {
    setSnapshot({ open, initialConfig })
    if (open) {
      setDraft(initialConfig)
      setError(null)
    }
  }

  function validateConfig(cfg: ReorderFormulaConfig): string | null {
    if (cfg.safetyStockDays < 0 || cfg.safetyStockDays > 60) {
      return 'روز ذخیره ایمن باید بین ۰ تا ۶۰ روز باشد.'
    }
    if (cfg.targetCoverageDays < 1 || cfg.targetCoverageDays > 180) {
      return 'افق پوشش هدف باید بین ۱ تا ۱۸۰ روز باشد.'
    }
    if (cfg.criticalDays < 1 || cfg.criticalDays > 30) {
      return 'آستانه وضعیت بحرانی باید بین ۱ تا ۳۰ روز باشد.'
    }
    if (cfg.lowDays < cfg.criticalDays || cfg.lowDays > 60) {
      return 'آستانه کمتر از حد ایمن باید بزرگ‌تر یا مساوی آستانه بحرانی (حداکثر ۶۰) باشد.'
    }
    if (cfg.reorderDays < cfg.lowDays || cfg.reorderDays > 90) {
      return 'آستانه زیر نقطه سفارش باید بزرگ‌تر یا مساوی حد ایمن (حداکثر ۹۰) باشد.'
    }
    return null
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const validationError = validateConfig(draft)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    await onSave(draft)
  }

  const body = (
    <form
      id="rop-settings-form"
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label className="text-label-lg font-semibold text-text-primary">
          روش محاسبه نقطه سفارش (ROP) و سقف هدف
        </Label>
        <RadioGroup
          value={draft.mode}
          onValueChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              mode: value as ReorderFormulaMode,
            }))
          }
          className="grid gap-2"
        >
          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-default border p-3 transition-colors',
              draft.mode === 'drug_defaults'
                ? 'border-primary bg-primary-tint/40'
                : 'border-border-default bg-surface',
            )}
          >
            <RadioGroupItem value="drug_defaults" className="mt-0.5" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-label-md font-semibold text-text-primary">
                <span>مقادیر ثابت کاتالوگ (Min / Max هر دارو)</span>
                <Badge variant="secondary">پیش‌فرض</Badge>
              </div>
              <p className="text-body-sm text-text-secondary">
                استفاده مستقیم از حداقل نقطه سفارش و سقف موجودی ثبت‌شده در پرونده
                هر دارو.
              </p>
            </div>
          </label>

          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-default border p-3 transition-colors',
              draft.mode === 'dynamic_adu'
                ? 'border-primary bg-primary-tint/40'
                : 'border-border-default bg-surface',
            )}
          >
            <RadioGroupItem value="dynamic_adu" className="mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-label-md font-semibold text-text-primary">
                محاسبه پویا بر اساس مصرف روزانه (ADU) و Lead Time
              </div>
              <p className="text-body-sm text-text-secondary">
                محاسبه خودکار ROP و سقف هدف با توجه به میانگین مصرف روزانه، زمان
                تحویل شرکت پخش و روزهای ذخیره ایمن.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <div className="rounded-default border border-border-default bg-surface-subtle p-3 text-body-sm">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-text-primary">
          <Icon name="tune" size={16} className="text-primary" data-slot="icon" />
          <span>فرمول فعال محاسبه:</span>
        </div>
        {draft.mode === 'dynamic_adu' ? (
          <div className="space-y-1 text-text-secondary">
            <div>
              • نقطه سفارش: <code className="font-latin text-text-primary">ROP = ⌈ADU × (LeadTime + {toPersianDigits(draft.safetyStockDays)})⌉</code>
            </div>
            <div>
              • سقف هدف: <code className="font-latin text-text-primary">Max = ⌈ADU × (LeadTime + {toPersianDigits(draft.safetyStockDays)} + {toPersianDigits(draft.targetCoverageDays)})⌉</code>
            </div>
          </div>
        ) : (
          <div className="text-text-secondary">
            • نقطه سفارش و سقف هدف مستقیماً از فیلدهای کاتالوگ هر قلم خوانده
            می‌شود.
          </div>
        )}
        <div className="mt-1 text-text-secondary">
          • مقدار سفارش: <span className="font-medium text-text-primary">سقف هدف − موجودی قابل مصرف {draft.includeOnOrder ? '− در راه' : ''}</span>{' '}
          {draft.roundToPackSize ? '(گرد به بالای مضرب بسته‌بندی)' : '(بدون گرد کردن بسته‌بندی)'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rop-safety-days">روز ذخیره ایمن (Safety Stock)</Label>
          <Input
            id="rop-safety-days"
            inputMode="numeric"
            value={toPersianDigits(draft.safetyStockDays)}
            disabled={draft.mode !== 'dynamic_adu'}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                safetyStockDays: Math.max(
                  0,
                  parseIntField(e.target.value, prev.safetyStockDays),
                ),
              }))
            }
          />
          <p className="text-label-sm text-text-secondary">
            برای روش پویا (۰ تا ۶۰ روز)
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rop-coverage-days">افق پوشش هدف پس از تحویل (روز)</Label>
          <Input
            id="rop-coverage-days"
            inputMode="numeric"
            value={toPersianDigits(draft.targetCoverageDays)}
            disabled={draft.mode !== 'dynamic_adu'}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                targetCoverageDays: Math.max(
                  1,
                  parseIntField(e.target.value, prev.targetCoverageDays),
                ),
              }))
            }
          />
          <p className="text-label-sm text-text-secondary">
            برای روش پویا (۱ تا ۱۸۰ روز)
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>حاشیه اطمینان پیش‌فرض (Buffer)</Label>
        <div className="flex items-center gap-2 rounded-default bg-surface-subtle p-1">
          {([0, 10, 20] as const).map((pct) => (
            <Button
              key={pct}
              type="button"
              size="sm"
              className="flex-1"
              variant={draft.defaultBufferPct === pct ? 'default' : 'ghost'}
              onClick={() =>
                setDraft((prev) => ({ ...prev, defaultBufferPct: pct }))
              }
            >
              {pct === 0 ? 'عادی (۰٪)' : `+${toPersianDigits(pct)}٪`}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-default border border-border-default p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="rop-include-on-order" className="cursor-pointer">
              کسر اقلام در راه (سفارش‌های باز)
            </Label>
            <p className="text-label-sm text-text-secondary">
              مقدار سفارش‌های ثبت‌شده قبلی از نیاز پیشنهادی کسر شود.
            </p>
          </div>
          <Switch
            id="rop-include-on-order"
            checked={draft.includeOnOrder}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, includeOnOrder: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border-default pt-3">
          <div>
            <Label htmlFor="rop-round-pack" className="cursor-pointer">
              گرد کردن به بالای مضرب بسته‌بندی
            </Label>
            <p className="text-label-sm text-text-secondary">
              تعداد پیشنهادی متناسب با ضریب کارتن/بسته پخش گرد شود.
            </p>
          </div>
          <Switch
            id="rop-round-pack"
            checked={draft.roundToPackSize}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, roundToPackSize: checked }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-label-lg font-semibold text-text-primary">
          آستانه‌های فوریت (بر حسب روز پوشش باقی‌مانده)
        </Label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="rop-critical-days" className="text-label-sm">
              بحرانی (≤ روز)
            </Label>
            <Input
              id="rop-critical-days"
              inputMode="numeric"
              value={toPersianDigits(draft.criticalDays)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  criticalDays: Math.max(
                    1,
                    parseIntField(e.target.value, prev.criticalDays),
                  ),
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rop-low-days" className="text-label-sm">
              حد ایمن (≤ روز)
            </Label>
            <Input
              id="rop-low-days"
              inputMode="numeric"
              value={toPersianDigits(draft.lowDays)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  lowDays: Math.max(
                    1,
                    parseIntField(e.target.value, prev.lowDays),
                  ),
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rop-reorder-days" className="text-label-sm">
              نقطه سفارش (≤ روز)
            </Label>
            <Input
              id="rop-reorder-days"
              inputMode="numeric"
              value={toPersianDigits(draft.reorderDays)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  reorderDays: Math.max(
                    1,
                    parseIntField(e.target.value, prev.reorderDays),
                  ),
                }))
              }
            />
          </div>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-default bg-status-critical-bg px-3 py-2 text-body-sm text-status-critical-fg"
        >
          {error}
        </p>
      ) : null}
    </form>
  )

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={saving}
        onClick={() => {
          setDraft(DEFAULT_REORDER_FORMULA)
          setError(null)
        }}
      >
        <Icon name="refresh" size={16} data-slot="icon" />
        بازنشانی پیش‌فرض
      </Button>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          انصراف
        </Button>
        <Button type="submit" form="rop-settings-form" disabled={saving}>
          <Icon name="save" size={18} data-slot="icon" />
          {saving ? 'در حال ذخیره...' : 'ذخیره و محاسبه مجدد'}
        </Button>
      </div>
    </div>
  )

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="تنظیمات فرمول نقطه سفارش (ROP)"
      description="پیکربندی مدل محاسبه نقطه سفارش، ذخیره ایمن، حاشیه اطمینان و آستانه‌های فوریت"
      footer={footer}
    >
      {body}
    </SideDrawer>
  )
}
