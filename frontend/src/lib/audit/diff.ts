export type AuditPayload = Record<string, string | number | boolean | null>

export type AuditDiffField = {
  key: string
  labelFa: string
  before: string
  after: string
  changed: boolean
}

const FIELD_LABELS: Record<string, string> = {
  quantity: 'موجودی',
  stock: 'موجودی کاردکس',
  price: 'قیمت مصرف‌کننده',
  status: 'وضعیت کاردکس',
  location: 'مکان فیزیکی',
  role: 'نقش',
  binAddress: 'آدرس قفسه',
  batchNo: 'شماره بچ',
  expiry: 'تاریخ انقضا',
  delta: 'تغییر',
  itemsAdded: 'اقلام ورودی جدید',
  reason: 'علت',
  trackingCode: 'کد رهگیری',
  cycleCode: 'کد دوره',
  adjustmentDocNo: 'شماره سند تعدیل',
  zone: 'زون / بخش',
  shortageUnits: 'مجموع کسری (واحد)',
  surplusUnits: 'مجموع مازاد (واحد)',
  netVarianceRial: 'خالص اثر مالی (ریال)',
  adjustedItems: 'اقلام تعدیل‌شده',
}

function stringifyValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر'
  return String(value)
}

export function labelForAuditField(key: string): string {
  return FIELD_LABELS[key] ?? key
}

/**
 * Field-by-field before/after diff. Changed fields are flagged for highlight;
 * callers must also expose textual «قبل» / «بعد» labels (not color alone).
 */
export function diffAuditPayloads(
  before?: AuditPayload | null,
  after?: AuditPayload | null,
): AuditDiffField[] {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])
  const fields: AuditDiffField[] = []
  for (const key of [...keys].sort()) {
    const beforeRaw = before?.[key]
    const afterRaw = after?.[key]
    const beforeStr = stringifyValue(beforeRaw)
    const afterStr = stringifyValue(afterRaw)
    fields.push({
      key,
      labelFa: labelForAuditField(key),
      before: beforeStr,
      after: afterStr,
      changed: beforeStr !== afterStr,
    })
  }
  return fields
}

/** Compact one-line summary for table cells (first changed field). */
export function summarizeAuditDiff(
  before?: AuditPayload | null,
  after?: AuditPayload | null,
): { labelFa: string; before: string; after: string } | null {
  const changed = diffAuditPayloads(before, after).filter((f) => f.changed)
  const first = changed[0]
  if (!first) return null
  return {
    labelFa: first.labelFa,
    before: first.before,
    after: first.after,
  }
}
