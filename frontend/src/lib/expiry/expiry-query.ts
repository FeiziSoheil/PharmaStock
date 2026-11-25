import {
  daysUntilExpiry,
  getExpiryBucket,
  type ExpiryBucket,
} from '@/lib/domain/expiry'
import { normalizePersianText } from '@/lib/persian'
import type { DrugCategory } from '@/lib/types/drugs'
import type { ShelfZoneId } from '@/lib/types/shelves'
import type {
  ExpiryBatch,
  ExpiryBatchStatus,
} from '@/lib/types/expiry'

export type ExpirySortField =
  | 'expiry'
  | 'nameFa'
  | 'quantity'
  | 'batchNo'
  | 'distributor'

export type ExpiryStageTab =
  | 'all_alerts'
  | 'expired'
  | 'critical'
  | 'warning'
  | 'marked_return'

export type ExpiryQueryParams = {
  search?: string
  bucket?: ExpiryBucket | ''
  category?: DrugCategory | ''
  isControlled?: boolean | null
  zone?: ShelfZoneId | ''
  status?: ExpiryBatchStatus | ''
  stageTab?: ExpiryStageTab | ''
  /** Exclude quarantined from "active alerts" counts/lists when true (default). */
  hideQuarantined?: boolean
  sortBy?: ExpirySortField
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  today?: Date
}

export type ExpiryQueryResult = {
  items: ExpiryBatch[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type ExpiryBucketCounts = Record<ExpiryBucket, number> & {
  allAlerts: number
  markedReturn: number
}

export function countExpiryBuckets(
  batches: ExpiryBatch[],
  today: Date,
): ExpiryBucketCounts {
  const counts: ExpiryBucketCounts = {
    expired: 0,
    critical: 0,
    warning: 0,
    watch: 0,
    ok: 0,
    allAlerts: 0,
    markedReturn: 0,
  }

  for (const batch of batches) {
    if (batch.status === 'marked_return') counts.markedReturn += 1
    const bucket = getExpiryBucket(batch.expiry, today)
    if (!bucket) continue
    counts[bucket] += 1
    if (bucket !== 'ok' && batch.status !== 'quarantined') {
      counts.allAlerts += 1
    }
  }
  return counts
}

function matchesSearch(batch: ExpiryBatch, rawSearch: string): boolean {
  const needle = normalizePersianText(rawSearch)
  if (!needle) return true
  const haystack = normalizePersianText(
    [
      batch.nameFa,
      batch.nameEn,
      batch.batchNo,
      batch.manufacturer,
      batch.distributor,
      batch.locationLabel,
    ].join(' '),
  )
  return haystack.includes(needle)
}

function matchesStageTab(
  batch: ExpiryBatch,
  tab: ExpiryStageTab,
  today: Date,
): boolean {
  if (tab === 'marked_return') return batch.status === 'marked_return'
  const bucket = getExpiryBucket(batch.expiry, today)
  if (!bucket) return false
  switch (tab) {
    case 'all_alerts':
      return bucket !== 'ok' && batch.status !== 'quarantined'
    case 'expired':
      return bucket === 'expired'
    case 'critical':
      return bucket === 'critical'
    case 'warning':
      return bucket === 'warning'
    default:
      return true
  }
}

function compareValues(
  a: string | number,
  b: string | number,
  dir: 'asc' | 'desc',
): number {
  const factor = dir === 'asc' ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * factor
  }
  return (
    String(a).localeCompare(String(b), 'fa', { sensitivity: 'base' }) * factor
  )
}

export function filterExpiryBatches(
  batches: ExpiryBatch[],
  params: ExpiryQueryParams = {},
): ExpiryBatch[] {
  const today = params.today ?? new Date()
  return batches.filter((batch) => {
    if (params.search && !matchesSearch(batch, params.search)) return false
    if (params.category && batch.category !== params.category) return false
    if (typeof params.isControlled === 'boolean') {
      if (batch.isControlled !== params.isControlled) return false
    }
    if (params.zone && batch.zone !== params.zone) return false
    if (params.status && batch.status !== params.status) return false
    if (params.bucket) {
      if (getExpiryBucket(batch.expiry, today) !== params.bucket) return false
      // Bucket KPI/filter takes precedence over stage tabs that also encode a bucket.
      // Still honor marked_return stage when both are active.
      if (params.stageTab === 'marked_return' && batch.status !== 'marked_return') {
        return false
      }
      return true
    }
    if (params.stageTab) {
      if (!matchesStageTab(batch, params.stageTab, today)) return false
    }
    return true
  })
}

export function sortExpiryBatches(
  batches: ExpiryBatch[],
  sortBy: ExpirySortField = 'expiry',
  sortDir: 'asc' | 'desc' = 'asc',
): ExpiryBatch[] {
  const sorted = [...batches]
  sorted.sort((left, right) => {
    switch (sortBy) {
      case 'nameFa':
        return compareValues(left.nameFa, right.nameFa, sortDir)
      case 'quantity':
        return compareValues(left.quantity, right.quantity, sortDir)
      case 'batchNo':
        return compareValues(left.batchNo, right.batchNo, sortDir)
      case 'distributor':
        return compareValues(left.distributor, right.distributor, sortDir)
      case 'expiry':
      default: {
        const byExpiry = compareValues(left.expiry, right.expiry, sortDir)
        if (byExpiry !== 0) return byExpiry
        return compareValues(left.batchNo, right.batchNo, 'asc')
      }
    }
  })
  return sorted
}

export function paginateExpiryBatches(
  batches: ExpiryBatch[],
  page = 1,
  pageSize = 10,
): ExpiryQueryResult {
  const safeSize = [10, 25, 50].includes(pageSize) ? pageSize : 10
  const total = batches.length
  const pageCount = Math.max(1, Math.ceil(total / safeSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * safeSize
  return {
    items: batches.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    pageCount,
    total,
  }
}

export function applyExpiryQuery(
  batches: ExpiryBatch[],
  params: ExpiryQueryParams = {},
): ExpiryQueryResult {
  const filtered = filterExpiryBatches(batches, params)
  const sorted = sortExpiryBatches(
    filtered,
    params.sortBy ?? 'expiry',
    params.sortDir ?? 'asc',
  )
  return paginateExpiryBatches(sorted, params.page ?? 1, params.pageSize ?? 10)
}

/** Remaining-days Persian label (digits via caller formatting). */
export function remainingDaysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} روز گذشته`
  if (days === 0) return 'امروز منقضی می‌شود'
  return `${days} روز مانده`
}

export { daysUntilExpiry, getExpiryBucket }
