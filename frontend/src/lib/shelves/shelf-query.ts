import { daysUntil, normalizePersianText } from '@/lib/persian'
import { addressMatchesQuery } from '@/lib/shelves/address'
import type {
  ShelfBin,
  ShelfBinStatus,
  ShelfStockStatusFilter,
  ShelfZoneId,
} from '@/lib/types/shelves'

export type ShelfSortField = 'address' | 'expiry' | 'quantity' | 'nameFa'

export type ShelfQueryParams = {
  search?: string
  zone?: ShelfZoneId | ''
  stockStatus?: ShelfStockStatusFilter | ''
  controlledOnly?: boolean
  expiringSoon?: boolean
  /** Stitch macro location tab (main / dispensing / cold). */
  macroLocation?: 'main' | 'dispensing' | 'cold' | ''
  sortBy?: ShelfSortField
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  now?: Date
}

export type ShelfQueryResult = {
  items: ShelfBin[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export const EXPIRING_SOON_DAYS = 90

/** Derive occupancy/status for a bin cell (priority: controlled > expiring > low > occupied/empty). */
export function deriveBinStatus(
  bin: ShelfBin,
  now = new Date(),
): ShelfBinStatus {
  if (bin.isControlled) return 'controlled'
  if (bin.batches.length === 0) return 'empty'

  const nearest = nearestExpiryIso(bin)
  if (nearest !== null && daysUntil(nearest, now) <= EXPIRING_SOON_DAYS) {
    return 'expiring'
  }

  const qty = totalQuantity(bin)
  const fill = bin.capacity > 0 ? qty / bin.capacity : 0
  if (fill > 0 && fill <= 0.25) return 'low'
  return 'occupied'
}

export function totalQuantity(bin: ShelfBin): number {
  return bin.batches.reduce((sum, batch) => sum + batch.quantity, 0)
}

export function nearestExpiryIso(bin: ShelfBin): string | null {
  if (bin.batches.length === 0) return null
  return [...bin.batches]
    .map((b) => b.expiry)
    .sort((a, b) => a.localeCompare(b))[0] ?? null
}

/** FEFO: earliest expiry first; ties by batch number. */
export function sortBatchesFefo(bin: ShelfBin): ShelfBin['batches'] {
  return [...bin.batches].sort((a, b) => {
    const byExpiry = a.expiry.localeCompare(b.expiry)
    if (byExpiry !== 0) return byExpiry
    return a.batchNo.localeCompare(b.batchNo, 'en')
  })
}

function matchesSearch(bin: ShelfBin, rawSearch: string): boolean {
  const needle = normalizePersianText(rawSearch)
  if (!needle) return true

  if (addressMatchesQuery(bin.address, rawSearch)) return true

  const haystack = normalizePersianText(
    [
      bin.address,
      bin.zoneLabel,
      ...bin.batches.flatMap((batch) => [batch.nameFa, batch.batchNo]),
    ].join(' '),
  )
  return haystack.includes(needle)
}

function matchesStockStatus(
  bin: ShelfBin,
  status: ShelfStockStatusFilter,
  now: Date,
): boolean {
  const derived = deriveBinStatus(bin, now)
  switch (status) {
    case 'empty':
      return derived === 'empty'
    case 'occupied':
      return derived === 'occupied'
    case 'low':
      return derived === 'low'
    case 'expiring':
      return derived === 'expiring'
    case 'controlled':
      return derived === 'controlled'
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

export function filterShelves(
  bins: ShelfBin[],
  params: ShelfQueryParams = {},
): ShelfBin[] {
  const now = params.now ?? new Date()
  return bins.filter((bin) => {
    if (params.search && !matchesSearch(bin, params.search)) return false
    if (params.zone && bin.zone !== params.zone) return false
    if (params.macroLocation && bin.macroLocation !== params.macroLocation) {
      return false
    }
    if (params.controlledOnly && !bin.isControlled) return false
    if (params.expiringSoon) {
      const nearest = nearestExpiryIso(bin)
      if (nearest === null || daysUntil(nearest, now) > EXPIRING_SOON_DAYS) {
        return false
      }
    }
    if (params.stockStatus && !matchesStockStatus(bin, params.stockStatus, now)) {
      return false
    }
    return true
  })
}

export function sortShelves(
  bins: ShelfBin[],
  sortBy: ShelfSortField = 'address',
  sortDir: 'asc' | 'desc' = 'asc',
): ShelfBin[] {
  const sorted = [...bins]
  sorted.sort((left, right) => {
    switch (sortBy) {
      case 'expiry': {
        const a = nearestExpiryIso(left) ?? '9999-12-31'
        const b = nearestExpiryIso(right) ?? '9999-12-31'
        return compareValues(a, b, sortDir)
      }
      case 'quantity':
        return compareValues(totalQuantity(left), totalQuantity(right), sortDir)
      case 'nameFa': {
        const a = left.batches[0]?.nameFa ?? ''
        const b = right.batches[0]?.nameFa ?? ''
        return compareValues(a, b, sortDir)
      }
      case 'address':
      default:
        return compareValues(left.address, right.address, sortDir)
    }
  })
  return sorted
}

export function paginateShelves(
  bins: ShelfBin[],
  page = 1,
  pageSize = 25,
): ShelfQueryResult {
  const allowed = [10, 25, 50, 100]
  const safeSize = allowed.includes(pageSize) ? pageSize : 25
  const total = bins.length
  const pageCount = Math.max(1, Math.ceil(total / safeSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * safeSize
  return {
    items: bins.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    pageCount,
    total,
  }
}

export function applyShelfQuery(
  bins: ShelfBin[],
  params: ShelfQueryParams = {},
): ShelfQueryResult {
  const filtered = filterShelves(bins, params)
  const sorted = sortShelves(
    filtered,
    params.sortBy ?? 'address',
    params.sortDir ?? 'asc',
  )
  return paginateShelves(sorted, params.page ?? 1, params.pageSize ?? 25)
}
