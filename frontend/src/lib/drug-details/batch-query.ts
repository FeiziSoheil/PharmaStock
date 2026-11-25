import { getExpiryBucket, type ExpiryBucket } from '@/lib/domain/expiry'
import type { BatchFilter, DrugBatchRow } from '@/lib/drug-details/types'

export type BatchKpis = {
  dispensableQty: number
  activeBatchCount: number
  quarantineBatchCount: number
  fefoBatchNo: string | null
  fefoExpiryISO: string | null
  totalQty: number
}

export type BatchQueryParams = {
  batchFilter: BatchFilter
  q: string
  page: number
  pageSize: number
  todayISO: string
}

export type BatchQueryResult = {
  rows: DrugBatchRow[]
  total: number
  fefoPriorityIds: string[]
  kpis: BatchKpis
}

const EXPIRING_BUCKETS: ReadonlySet<ExpiryBucket> = new Set([
  'expired',
  'critical',
  'warning',
  'watch',
])

function parseToday(todayISO: string): Date {
  const [y, m, d] = todayISO.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function isQuarantineLike(row: DrugBatchRow): boolean {
  return row.status === 'quarantine' || row.status === 'blocked'
}

function isFefoEligible(row: DrugBatchRow): boolean {
  return row.status === 'active' && row.quantity > 0 && !isQuarantineLike(row)
}

function matchesBatchFilter(
  row: DrugBatchRow,
  filter: BatchFilter,
  today: Date,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'in-stock':
      return row.quantity > 0
    case 'quarantine':
      return isQuarantineLike(row)
    case 'expiring': {
      if (row.status !== 'active' || row.quantity <= 0) return false
      const bucket = getExpiryBucket(row.expiryISO, today)
      return bucket !== null && EXPIRING_BUCKETS.has(bucket)
    }
    default:
      return true
  }
}

function matchesSearch(row: DrugBatchRow, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return (
    row.batchNo.toLowerCase().includes(needle) ||
    row.locationLabel.toLowerCase().includes(needle)
  )
}

/** Gross margin percent: (consumer − buy) / buy × 100. */
export function marginPercent(buy: number, consumer: number): number {
  if (buy === 0) return 0
  return ((consumer - buy) / buy) * 100
}

/** Nearest-expiry first among active in-stock non-quarantine batches. */
export function rankFefo(rows: DrugBatchRow[], todayISO: string): string[] {
  void todayISO
  return [...rows]
    .filter(isFefoEligible)
    .sort((a, b) => a.expiryISO.localeCompare(b.expiryISO))
    .map((row) => row.id)
}

function sortForDisplay(rows: DrugBatchRow[]): DrugBatchRow[] {
  const eligible = rows
    .filter(isFefoEligible)
    .sort((a, b) => a.expiryISO.localeCompare(b.expiryISO))
  const eligibleIds = new Set(eligible.map((r) => r.id))
  const others = rows
    .filter((r) => !eligibleIds.has(r.id))
    .sort((a, b) => a.expiryISO.localeCompare(b.expiryISO))
  return [...eligible, ...others]
}

function computeKpis(rows: DrugBatchRow[], todayISO: string): BatchKpis {
  const fefoIds = rankFefo(rows, todayISO)
  const fefoRow = fefoIds.length
    ? rows.find((r) => r.id === fefoIds[0]) ?? null
    : null

  let dispensableQty = 0
  let activeBatchCount = 0
  let quarantineBatchCount = 0
  let totalQty = 0

  for (const row of rows) {
    totalQty += row.quantity
    if (isQuarantineLike(row)) {
      quarantineBatchCount += 1
    } else if (row.status === 'active') {
      activeBatchCount += 1
      if (row.quantity > 0) dispensableQty += row.quantity
    }
  }

  return {
    dispensableQty,
    activeBatchCount,
    quarantineBatchCount,
    fefoBatchNo: fefoRow?.batchNo ?? null,
    fefoExpiryISO: fefoRow?.expiryISO ?? null,
    totalQty,
  }
}

export function applyBatchQuery(
  rows: DrugBatchRow[],
  params: BatchQueryParams,
): BatchQueryResult {
  const today = parseToday(params.todayISO)
  const fefoPriorityIds = rankFefo(rows, params.todayISO)
  const kpis = computeKpis(rows, params.todayISO)

  const filtered = rows.filter(
    (row) =>
      matchesBatchFilter(row, params.batchFilter, today) &&
      matchesSearch(row, params.q),
  )
  const sorted = sortForDisplay(filtered)
  const page = Math.max(1, params.page)
  const pageSize = Math.max(1, params.pageSize)
  const start = (page - 1) * pageSize

  return {
    rows: sorted.slice(start, start + pageSize),
    total: sorted.length,
    fefoPriorityIds,
    kpis,
  }
}
