import type { TriageStatus } from '@/components/shared'
import { formatJalaliDate, toPersianDigits } from '@/lib/persian'
import type { InventoryRow, InventoryStatus } from './types'

export const INVENTORY_STATUS_META: Record<
  InventoryStatus,
  { label: string; triage: TriageStatus }
> = {
  valid: { label: 'موجود و معتبر', triage: 'valid' },
  low: { label: 'روبه‌اتمام (کسری)', triage: 'warning' },
  expiring: { label: 'نزدیک انقضا (اولویت FEFO)', triage: 'expiring' },
  expired_quarantine: { label: 'منقضی / قرنطینه', triage: 'critical' },
}

export const STORAGE_TEMP_LABELS: Record<string, string> = {
  room: 'دمای اتاق (۱۵ تا ۲۵°C)',
  fridge: 'یخچالی (۲ تا ۸°C)',
  light: 'محافظت دقیق از نور',
  freezer: 'فریزر (زیر صفر)',
}

export function stockCoverageRatio(quantity: number, reorderLevel: number): number {
  if (quantity <= 0) return 0
  const target = Math.max(reorderLevel * 3, reorderLevel + 20, 10)
  return Math.min(100, Math.max(6, Math.round((quantity / target) * 100)))
}

export function remainingDaysText(
  days: number,
  bucket: InventoryRow['expiryBucket'],
): string {
  if (bucket === 'expired' || days < 0) {
    return `${toPersianDigits(Math.abs(days))} روز منقضی شده`
  }
  if (days === 0) {
    return 'انقضای امروز'
  }
  if (days <= 30) {
    return `تنها ${toPersianDigits(days)} روز باقی‌مانده`
  }
  return `${toPersianDigits(days)} روز مانده`
}

export function formatTodayJalaliBanner(todayISO: string): string {
  const date = new Date(todayISO)
  if (Number.isNaN(date.getTime())) {
    return 'امروز'
  }
  let weekday = ''
  try {
    weekday = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      weekday: 'long',
    }).format(date)
  } catch {
    weekday = ''
  }
  const jalali = formatJalaliDate(todayISO)
  return weekday ? `امروز: ${weekday} ${jalali}` : `امروز: ${jalali}`
}

export type StockInFormValues = {
  mode: 'existing' | 'new'
  drugId: string
  nameFa: string
  brandName: string
  dosageForm: string
  strength: string
  category: string
  genericCode: string
  gtin: string
  manufacturer: string
  isControlled: boolean
  storageTemp: 'room' | 'fridge' | 'freezer' | 'light'
  reorderLevel: string
  batchNo: string
  expiry: string
  quantity: string
  unitLabel: string
  binId: string
  locationLabel: string
  buyPriceRial: string
  consumerPriceRial: string
}

export type StockInFieldErrors = Partial<Record<keyof StockInFormValues, string>>

export function validateStockInForm(values: StockInFormValues): StockInFieldErrors {
  const errors: StockInFieldErrors = {}

  if (values.mode === 'existing') {
    if (!values.drugId.trim()) {
      errors.drugId = 'لطفاً یک دارو از کاتالوگ انتخاب کنید.'
    }
  } else {
    if (!values.nameFa.trim()) {
      errors.nameFa = 'نام رسمی فارسی دارو الزامی است.'
    }
    if (!values.dosageForm.trim()) {
      errors.dosageForm = 'شکل دارویی را انتخاب کنید.'
    }
    if (!values.strength.trim()) {
      errors.strength = 'دوز و قدرت اثر الزامی است.'
    }
    if (!values.category.trim()) {
      errors.category = 'دسته درمانی را انتخاب کنید.'
    }
  }

  if (!values.batchNo.trim()) {
    errors.batchNo = 'شماره سری ساخت (Batch No) الزامی است.'
  }
  if (!values.expiry.trim()) {
    errors.expiry = 'تاریخ انقضا الزامی است.'
  }

  const qty = Number(values.quantity)
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
    errors.quantity = 'تعداد ورودی باید عدد صحیح بزرگ‌تر از صفر باشد.'
  }

  const reorder = Number(values.reorderLevel || '0')
  if (!Number.isFinite(reorder) || reorder < 0) {
    errors.reorderLevel = 'نقطه سفارش نمی‌تواند منفی باشد.'
  }

  if (!values.binId.trim() && !values.locationLabel.trim()) {
    errors.binId = 'انتخاب موقعیت قفسه یا آدرس انبارش الزامی است.'
  }

  return errors
}
