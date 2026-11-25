import { daysUntil, normalizePersianText } from '@/lib/persian'
import type { Drug, DosageForm, DrugCategory } from '@/lib/types/drugs'

export type StockStatusFilter = 'valid' | 'warning' | 'expiring' | 'critical'
export type DerivedStockStatus = StockStatusFilter

export type DrugSortField =
  | 'nameFa'
  | 'brandName'
  | 'totalStock'
  | 'nearestExpiry'
  | 'dosageForm'

export type DrugQueryParams = {
  search?: string
  dosageForm?: DosageForm | ''
  category?: DrugCategory | ''
  isControlled?: boolean | null
  stockStatus?: StockStatusFilter | ''
  sortBy?: DrugSortField
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  /** Optional clock for deterministic tests. */
  now?: Date
}

export type DrugQueryResult = {
  items: Drug[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

const EXPIRING_DAYS = 90

/** Derive triage stock status from stock levels and nearest expiry. */
export function deriveStockStatus(
  drug: Drug,
  now = new Date(),
): DerivedStockStatus {
  if (drug.totalStock <= 0) return 'critical'
  const until = daysUntil(drug.nearestExpiry, now)
  if (until <= EXPIRING_DAYS) return 'expiring'
  if (drug.totalStock <= drug.reorderLevel) return 'warning'
  return 'valid'
}

function matchesSearch(drug: Drug, rawSearch: string): boolean {
  const needle = normalizePersianText(rawSearch)
  if (!needle) return true
  const haystack = normalizePersianText(
    [
      drug.nameFa,
      drug.brandName,
      drug.genericCode,
      drug.gtin,
      drug.atcCode ?? '',
      drug.manufacturer,
    ].join(' '),
  )
  return haystack.includes(needle)
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

export function filterDrugs(
  drugs: Drug[],
  params: DrugQueryParams = {},
): Drug[] {
  const now = params.now ?? new Date()
  return drugs.filter((drug) => {
    if (params.search && !matchesSearch(drug, params.search)) return false
    if (params.dosageForm && drug.dosageForm !== params.dosageForm) return false
    if (params.category && drug.category !== params.category) return false
    if (typeof params.isControlled === 'boolean') {
      if (drug.isControlled !== params.isControlled) return false
    }
    if (params.stockStatus) {
      if (deriveStockStatus(drug, now) !== params.stockStatus) return false
    }
    return true
  })
}

export function sortDrugs(
  drugs: Drug[],
  sortBy: DrugSortField = 'nameFa',
  sortDir: 'asc' | 'desc' = 'asc',
): Drug[] {
  const sorted = [...drugs]
  sorted.sort((left, right) => {
    switch (sortBy) {
      case 'brandName':
        return compareValues(left.brandName, right.brandName, sortDir)
      case 'totalStock':
        return compareValues(left.totalStock, right.totalStock, sortDir)
      case 'nearestExpiry':
        return compareValues(left.nearestExpiry, right.nearestExpiry, sortDir)
      case 'dosageForm':
        return compareValues(left.dosageForm, right.dosageForm, sortDir)
      case 'nameFa':
      default:
        return compareValues(left.nameFa, right.nameFa, sortDir)
    }
  })
  return sorted
}

export function paginateDrugs(
  drugs: Drug[],
  page = 1,
  pageSize = 10,
): { items: Drug[]; page: number; pageSize: number; pageCount: number; total: number } {
  const safeSize = [10, 25, 50].includes(pageSize) ? pageSize : 10
  const total = drugs.length
  const pageCount = Math.max(1, Math.ceil(total / safeSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * safeSize
  return {
    items: drugs.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    pageCount,
    total,
  }
}

/** Full client-side query pipeline over an in-memory drug list. */
export function applyDrugQuery(
  drugs: Drug[],
  params: DrugQueryParams = {},
): DrugQueryResult {
  const filtered = filterDrugs(drugs, params)
  const sorted = sortDrugs(
    filtered,
    params.sortBy ?? 'nameFa',
    params.sortDir ?? 'asc',
  )
  const paged = paginateDrugs(sorted, params.page ?? 1, params.pageSize ?? 10)
  return paged
}
