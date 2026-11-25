import type {
  ColumnMapping,
  PurchaseReconciliation,
  ReconciledRow,
  ReconciliationRowFilter,
} from '@/lib/types/reconciliation'
import { formatJalaliDate, normalizePersianText, toPersianDigits } from '@/lib/persian'

export type DistributorTemplateOption = {
  id: string
  label: string
  distributor: string
}

export const DISTRIBUTOR_TEMPLATES: DistributorTemplateOption[] = [
  {
    id: 'hijrat',
    label: 'الگوی استاندارد شرکت پخش هجرت',
    distributor: 'پخش هجرت',
  },
  {
    id: 'daroupakhsh',
    label: 'الگوی استاندارد داروپخش',
    distributor: 'داروپخش',
  },
  {
    id: 'razi',
    label: 'الگوی استاندارد پخش رازی',
    distributor: 'پخش رازی',
  },
  {
    id: 'alborz',
    label: 'الگوی استاندارد پخش البرز',
    distributor: 'پخش البرز',
  },
  {
    id: 'custom',
    label: 'نگاشت سفارشی ستون‌ها',
    distributor: 'سایر شرکت‌های پخش',
  },
]

export type MappingFieldMeta = {
  key: keyof ColumnMapping
  label: string
  required?: boolean
}

export const MAPPING_FIELDS: MappingFieldMeta[] = [
  { key: 'nameFa', label: 'نام کالا (دارو)', required: true },
  { key: 'gtin', label: 'بارکد تجاری / GTIN' },
  { key: 'irc', label: 'شناسه IRC' },
  { key: 'batchNo', label: 'شماره بچ (سری ساخت)', required: true },
  { key: 'expiry', label: 'تاریخ انقضا (شمسی)', required: true },
  { key: 'quantity', label: 'تعداد / بسته', required: true },
  { key: 'buyPriceRial', label: 'قیمت خرید فاکتور', required: true },
  { key: 'consumerPriceRial', label: 'قیمت مصرف‌کننده' },
]

export function getTemplateLabel(templateId: string): string {
  return (
    DISTRIBUTOR_TEMPLATES.find((t) => t.id === templateId)?.label ??
    'الگوی استاندارد شرکت پخش'
  )
}

export function countMappedFields(mapping: ColumnMapping): number {
  return MAPPING_FIELDS.filter((field) => mapping[field.key] >= 0).length
}

export function rowNeedsAction(row: ReconciledRow): boolean {
  if (row.matchStatus === 'new_item') return true
  if (row.matchStatus === 'price_mismatch' && !row.priceApproved) return true
  return false
}

export function filterReconciledRows(
  rows: ReconciledRow[],
  filter: ReconciliationRowFilter,
  search = '',
): ReconciledRow[] {
  const needle = normalizePersianText(search)
  return rows.filter((row) => {
    if (filter === 'action_needed' && !rowNeedsAction(row)) return false
    if (filter === 'matched' && rowNeedsAction(row)) return false
    if (filter === 'price_mismatch' && row.matchStatus !== 'price_mismatch') return false
    if (filter === 'new_item' && row.matchStatus !== 'new_item') return false

    if (!needle) return true
    const haystack = normalizePersianText(
      [
        row.excelName,
        row.catalogNameFa ?? '',
        row.gtin ?? '',
        row.irc ?? '',
        row.batchNo,
      ].join(' '),
    )
    return haystack.includes(needle)
  })
}

export function formatFileSizeFa(bytes: number): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${toPersianDigits(bytes)} B`
  if (bytes < 1024 * 1024) return `${toPersianDigits((bytes / 1024).toFixed(1))} KB`
  return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(1))} MB`
}

export function formatRowExpiryFa(row: ReconciledRow): string {
  if (row.expiryRaw) return toPersianDigits(row.expiryRaw)
  if (row.expiryISO) return formatJalaliDate(row.expiryISO)
  return '—'
}

export function formatPriceVarianceFa(diffPct?: number): string {
  if (diffPct === undefined || diffPct === 0) return ''
  const sign = diffPct > 0 ? '+' : ''
  return `${sign}${toPersianDigits(diffPct.toFixed(1))}٪`
}

export function canConfirmReconciliation(
  rec: PurchaseReconciliation | null,
): boolean {
  if (!rec || rec.status === 'confirmed' || rec.status === 'cancelled') {
    return false
  }
  if (rec.rows.length === 0) return false
  return rec.rows.every(
    (row) =>
      Boolean(row.drugId) &&
      row.matchStatus !== 'new_item' &&
      (row.matchStatus !== 'price_mismatch' || Boolean(row.priceApproved)) &&
      Boolean(row.batchNo.trim()) &&
      Boolean(row.expiryISO.trim()) &&
      row.quantity > 0,
  )
}
