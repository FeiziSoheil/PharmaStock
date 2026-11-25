'use client'

import * as React from 'react'
import {
  Badge,
  Button,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { SideDrawer } from '@/components/shared'
import { fetchDrugs } from '@/lib/drugs/data-access'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'
import { formatFileSizeFa } from '@/lib/reconciliation/helpers'
import type { RowPatchBody } from '@/lib/reconciliation/data-access'
import type { Drug } from '@/lib/types/drugs'
import type {
  ReconciledRow,
  ReconciliationHistoryItem,
  ReconciliationStatus,
} from '@/lib/types/reconciliation'

const STATUS_BADGE: Record<
  ReconciliationStatus,
  { label: string; variant: 'valid' | 'warning' | 'neutral' | 'critical' }
> = {
  uploaded: { label: 'بارگذاری‌شده', variant: 'neutral' },
  mapped: { label: 'در حال بررسی', variant: 'warning' },
  confirmed: { label: 'تایید و ثبت نهایی', variant: 'valid' },
  cancelled: { label: 'لغوشده', variant: 'critical' },
}

export function ReconciliationHistoryDrawer({
  open,
  onOpenChange,
  items,
  loading,
  activeId,
  onSelect,
  onRefresh,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ReconciliationHistoryItem[]
  loading: boolean
  activeId?: string
  onSelect: (id: string) => void
  onRefresh: () => void
}) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="سوابق فاکتورهای واردشده"
      description="انتخاب پیش‌نویس‌های قبلی یا مشاهده فاکتورهای اکسل تاییدشده"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <Icon name="refresh" size={16} data-slot="icon" />
            بروزرسانی فهرست
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-body-sm text-text-secondary">
          در حال دریافت سوابق…
        </p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-body-sm text-text-secondary">
          هنوز فاکتور اکسلی ثبت نشده است.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const badge = STATUS_BADGE[item.status]
            const isCurrent = item.id === activeId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item.id)
                    onOpenChange(false)
                  }}
                  className={
                    isCurrent
                      ? 'flex w-full flex-col gap-2 rounded-default border border-primary bg-primary-tint/50 p-3 text-start'
                      : 'flex w-full flex-col gap-2 rounded-default border border-border-default bg-surface p-3 text-start transition-colors hover:bg-surface-hover'
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-text-primary">
                      {item.invoiceNo || item.fileName}
                    </span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-label-sm text-text-secondary">
                    <span>{item.distributor}</span>
                    <span>•</span>
                    <span dir="ltr" className="font-latin">
                      {item.fileName}
                    </span>
                    <span>({formatFileSizeFa(item.fileSizeBytes)})</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2 text-label-sm tabular-nums-data text-text-secondary">
                    <span>
                      {formatPersianNumber(item.summary.totalRows)} قلم · خالص:{' '}
                      {formatRial(item.summary.netRial)}
                    </span>
                    <span>{formatJalaliDate(item.updatedAt)}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </SideDrawer>
  )
}

export function ReconcileRowEditDrawer({
  open,
  onOpenChange,
  row,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: ReconciledRow | null
  saving: boolean
  onSave: (rowId: string, patch: RowPatchBody) => Promise<void>
}) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="ویرایش و انطباق جزئیات ردیف فاکتور"
      description="اصلاح سری ساخت، تاریخ انقضا، قیمت یا اتصال دستی به داروی کاتالوگ"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            type="submit"
            form="reconcile-row-edit-form"
            loading={saving}
            disabled={!row}
          >
            <Icon name="save" size={18} data-slot="icon" />
            ذخیره تغییرات ردیف
          </Button>
        </div>
      }
    >
      {open && row ? (
        <RowEditFormBody key={row.id} row={row} onSave={onSave} />
      ) : null}
    </SideDrawer>
  )
}

function RowEditFormBody({
  row,
  onSave,
}: {
  row: ReconciledRow
  onSave: (rowId: string, patch: RowPatchBody) => Promise<void>
}) {
  const [drugs, setDrugs] = React.useState<Drug[]>([])
  const [drugId, setDrugId] = React.useState(row.drugId ?? '')
  const [batchNo, setBatchNo] = React.useState(row.batchNo)
  const [expiryRaw, setExpiryRaw] = React.useState(
    row.expiryRaw || row.expiryISO,
  )
  const [quantity, setQuantity] = React.useState(String(row.quantity))
  const [buyPriceRial, setBuyPriceRial] = React.useState(
    String(row.buyPriceRial),
  )
  const [consumerPriceRial, setConsumerPriceRial] = React.useState(
    String(row.consumerPriceRial ?? 0),
  )
  const [locationLabel, setLocationLabel] = React.useState(
    row.locationLabel ?? '',
  )
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    void fetchDrugs({ pageSize: 100 })
      .then((res) => {
        if (active) setDrugs(res.items)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const qty = Number(quantity)
    const buy = Number(buyPriceRial)
    const consumer = Number(consumerPriceRial)
    if (!batchNo.trim()) {
      setError('شماره سری ساخت الزامی است.')
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('تعداد باید بزرگ‌تر از صفر باشد.')
      return
    }
    setError(null)
    await onSave(row.id, {
      ...(drugId ? { drugId } : {}),
      batchNo: batchNo.trim(),
      expiryRaw: expiryRaw.trim(),
      quantity: Math.round(qty),
      buyPriceRial: Number.isFinite(buy) ? Math.max(0, Math.round(buy)) : 0,
      consumerPriceRial: Number.isFinite(consumer)
        ? Math.max(0, Math.round(consumer))
        : 0,
      locationLabel: locationLabel.trim(),
    })
  }

  return (
    <form
      id="reconcile-row-edit-form"
      className="flex flex-col gap-4 pb-4"
      onSubmit={handleSubmit}
    >
      <div className="rounded-default border border-border-subtle bg-surface-muted p-3 text-body-sm">
        <div className="font-semibold text-text-primary">{row.excelName}</div>
        <div className="mt-1 flex flex-wrap gap-3 text-label-sm text-text-secondary">
          <span dir="ltr" className="font-latin">
            GTIN: {row.gtin || '—'}
          </span>
          <span dir="ltr" className="font-latin">
            IRC: {row.irc || '—'}
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded-default border border-status-critical-border bg-status-critical-bg px-3 py-2 text-body-sm text-status-critical-fg">
          {error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="row-edit-drug">اتصال به داروی کاتالوگ</Label>
        <Select
          value={drugId || '__unmapped__'}
          onValueChange={(val) => setDrugId(val === '__unmapped__' ? '' : val)}
        >
          <SelectTrigger id="row-edit-drug">
            <SelectValue placeholder="انتخاب دارو از کاتالوگ..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unmapped__">بدون اتصال (قلم جدید)</SelectItem>
            {drugs.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.dosageForm} {d.nameFa} {d.strength}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="row-edit-batch">شماره بچ (سری ساخت)</Label>
          <Input
            id="row-edit-batch"
            dir="ltr"
            className="font-latin"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="row-edit-expiry">تاریخ انقضا (شمسی / میلادی)</Label>
          <Input
            id="row-edit-expiry"
            dir="ltr"
            className="font-latin"
            placeholder={toPersianDigits('1406/03/15')}
            value={expiryRaw}
            onChange={(e) => setExpiryRaw(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="row-edit-qty">تعداد</Label>
          <Input
            id="row-edit-qty"
            type="number"
            min={1}
            dir="ltr"
            className="font-latin"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="row-edit-buy">قیمت خرید (ریال)</Label>
          <Input
            id="row-edit-buy"
            type="number"
            min={0}
            dir="ltr"
            className="font-latin"
            value={buyPriceRial}
            onChange={(e) => setBuyPriceRial(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="row-edit-consumer">مصرف‌کننده (ریال)</Label>
          <Input
            id="row-edit-consumer"
            type="number"
            min={0}
            dir="ltr"
            className="font-latin"
            value={consumerPriceRial}
            onChange={(e) => setConsumerPriceRial(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="row-edit-loc">آدرس قفسه (اختیاری)</Label>
        <Input
          id="row-edit-loc"
          dir="ltr"
          className="font-latin"
          placeholder="A-03-2-04"
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value)}
        />
      </div>
    </form>
  )
}
