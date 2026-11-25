/** Configurable FEFO / expiry triage thresholds (days from `today`). */
export const EXPIRY_THRESHOLDS = {
  /** Inclusive upper bound for critical (≤ N days remaining, including today). */
  criticalMaxDays: 30,
  /** Inclusive upper bound for warning (criticalMaxDays+1 … N). */
  warningMaxDays: 90,
  /** Inclusive upper bound for watch (warningMaxDays+1 … N). */
  watchMaxDays: 180,
} as const

export type ExpiryBucket =
  | 'expired'
  | 'critical'
  | 'warning'
  | 'watch'
  | 'ok'

export const EXPIRY_BUCKET_LABELS: Record<ExpiryBucket, string> = {
  expired: 'منقضی شده',
  critical: 'کمتر از ۱ ماه (فوری)',
  warning: '۱ تا ۳ ماه (هشدار)',
  watch: '۳ تا ۶ ماه (پیگیری)',
  ok: 'بیش از ۶ ماه (ایمن)',
}

export const EXPIRY_BUCKET_TRIAGE: Record<
  ExpiryBucket,
  'critical' | 'expiring' | 'warning' | 'info' | 'valid'
> = {
  expired: 'critical',
  critical: 'expiring',
  warning: 'warning',
  watch: 'info',
  ok: 'valid',
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parse YYYY-MM-DD (or full ISO) into a UTC calendar day; null if invalid. */
export function parseExpiryDate(expiryISO: string): Date | null {
  const trimmed = expiryISO.trim()
  if (!trimmed) return null
  const match = ISO_DATE.exec(trimmed)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const date = new Date(Date.UTC(year, month - 1, day))
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null
    }
    return date
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

/**
 * Calendar-day difference: expiry − today.
 * Negative = already expired. `today` is injectable (never uses Date.now()).
 */
export function daysUntilExpiry(expiryISO: string, today: Date): number | null {
  const target = parseExpiryDate(expiryISO)
  if (!target) return null
  const msPerDay = 24 * 60 * 60 * 1000
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const end = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  )
  return Math.round((end - start) / msPerDay)
}

/**
 * Classify an expiry date into a triage bucket.
 * Edge cases: today → critical; exact thresholds inclusive on the upper side of each band;
 * invalid date → null.
 */
export function getExpiryBucket(
  expiryISO: string,
  today: Date,
): ExpiryBucket | null {
  const days = daysUntilExpiry(expiryISO, today)
  if (days === null) return null
  if (days < 0) return 'expired'
  if (days <= EXPIRY_THRESHOLDS.criticalMaxDays) return 'critical'
  if (days <= EXPIRY_THRESHOLDS.warningMaxDays) return 'warning'
  if (days <= EXPIRY_THRESHOLDS.watchMaxDays) return 'watch'
  return 'ok'
}

export type FefoListItem = {
  drugId: string
  batchId: string
  expiryISO: string
}

export type FefoViolation = {
  drugId: string
  /** Batch listed earlier (wrongly ahead). */
  aheadBatchId: string
  /** Older-expiry batch listed later. */
  behindBatchId: string
}

/**
 * Domain FEFO rule: a newer (later-expiry) batch must not appear ahead of an older
 * batch of the same drug in the given list order.
 */
export function findFefoViolations(list: FefoListItem[]): FefoViolation[] {
  const violations: FefoViolation[] = []
  for (let i = 0; i < list.length; i++) {
    const ahead = list[i]!
    for (let j = i + 1; j < list.length; j++) {
      const behind = list[j]!
      if (ahead.drugId !== behind.drugId) continue
      if (ahead.expiryISO > behind.expiryISO) {
        violations.push({
          drugId: ahead.drugId,
          aheadBatchId: ahead.batchId,
          behindBatchId: behind.batchId,
        })
      }
    }
  }
  return violations
}

export function hasFefoViolation(list: FefoListItem[]): boolean {
  return findFefoViolations(list).length > 0
}

export type ExpiryBatchLike = {
  quantity: number
  /** ISO calendar date YYYY-MM-DD */
  expiry: string
}

/**
 * Sum quantities that still count toward availableStock.
 * Expired batches (`getExpiryBucket` === 'expired') are excluded.
 */
export function sumUsableQuantity(
  batches: readonly ExpiryBatchLike[],
  today: Date,
): number {
  return batches.reduce((sum, batch) => {
    if (getExpiryBucket(batch.expiry, today) === 'expired') return sum
    return sum + Math.max(0, batch.quantity)
  }, 0)
}
