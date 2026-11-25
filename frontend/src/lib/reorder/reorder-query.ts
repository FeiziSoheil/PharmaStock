import { normalizePersianText } from '@/lib/persian'
import type { ReorderUrgency } from '@/lib/domain/reorder'

export type ReorderRowStatus = 'active' | 'order_drafted' | 'dismissed'

export type ReorderSuggestion = {
  id: string
  drugId: string
  nameFa: string
  dosageForm: string
  strength: string
  irc: string
  distributorId: string
  distributorNameFa: string
  distributorNote: string
  category: string
  isControlled: boolean
  availableStock: number
  reorderPoint: number
  targetStock: number
  onOrderQuantity: number
  avgDailyUsage: number
  packSize: number
  unitCost: number
  unitLabel: string
  leadTimeDays: number
  suggestedQty: number
  daysOfCover: number
  urgency: ReorderUrgency
  locationHint: string
  status: ReorderRowStatus
  storageTemp?: 'room' | 'fridge' | 'freezer' | 'light'
}

export type ReorderSortField =
  | 'daysOfCover'
  | 'nameFa'
  | 'availableStock'
  | 'suggestedQty'
  | 'distributorNameFa'
  | 'unitCost'

export type ReorderQueryParams = {
  search?: string
  distributorId?: string | ''
  category?: string | ''
  urgency?: ReorderUrgency | ''
  isControlled?: boolean | null
  activeOnly?: boolean
  sortBy?: ReorderSortField
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  now?: Date
}

export type ReorderQueryResult = {
  items: ReorderSuggestion[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type SelectionState = 'all' | 'indeterminate' | 'none'

export type DistributorSubtotal = {
  distributorId: string
  distributorNameFa: string
  itemCount: number
  estimatedCost: number
  quantities: number
}

function matchesSearch(item: ReorderSuggestion, rawSearch: string): boolean {
  const needle = normalizePersianText(rawSearch)
  if (!needle) return true
  const haystack = normalizePersianText(
    [item.nameFa, item.irc, item.dosageForm, item.strength, item.distributorNameFa].join(
      ' ',
    ),
  )
  return haystack.includes(needle)
}

export function filterReorderItems(
  items: ReorderSuggestion[],
  params: ReorderQueryParams = {},
): ReorderSuggestion[] {
  return items.filter((item) => {
    if (params.activeOnly && item.status !== 'active') return false
    if (params.search && !matchesSearch(item, params.search)) return false
    if (params.distributorId && item.distributorId !== params.distributorId) {
      return false
    }
    if (params.category && item.category !== params.category) return false
    if (params.urgency && item.urgency !== params.urgency) return false
    if (typeof params.isControlled === 'boolean') {
      if (item.isControlled !== params.isControlled) return false
    }
    return true
  })
}

function compareValues(
  a: string | number,
  b: string | number,
  dir: 'asc' | 'desc',
): number {
  const factor = dir === 'asc' ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') {
    const left = Number.isFinite(a) ? a : Number.POSITIVE_INFINITY
    const right = Number.isFinite(b) ? b : Number.POSITIVE_INFINITY
    return (left - right) * factor
  }
  return (
    String(a).localeCompare(String(b), 'fa', { sensitivity: 'base' }) * factor
  )
}

export function sortReorderItems(
  items: ReorderSuggestion[],
  sortBy: ReorderSortField = 'daysOfCover',
  sortDir: 'asc' | 'desc' = 'asc',
): ReorderSuggestion[] {
  const sorted = [...items]
  sorted.sort((left, right) => {
    switch (sortBy) {
      case 'nameFa':
        return compareValues(left.nameFa, right.nameFa, sortDir)
      case 'availableStock':
        return compareValues(left.availableStock, right.availableStock, sortDir)
      case 'suggestedQty':
        return compareValues(left.suggestedQty, right.suggestedQty, sortDir)
      case 'distributorNameFa':
        return compareValues(
          left.distributorNameFa,
          right.distributorNameFa,
          sortDir,
        )
      case 'unitCost':
        return compareValues(left.unitCost, right.unitCost, sortDir)
      case 'daysOfCover':
      default:
        return compareValues(left.daysOfCover, right.daysOfCover, sortDir)
    }
  })
  return sorted
}

export function paginateReorderItems(
  items: ReorderSuggestion[],
  page = 1,
  pageSize = 10,
): ReorderQueryResult {
  const safeSize = pageSize > 0 ? Math.floor(pageSize) : 10
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / safeSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * safeSize
  return {
    items: items.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    pageCount,
    total,
  }
}

export function applyReorderQuery(
  items: ReorderSuggestion[],
  params: ReorderQueryParams = {},
): ReorderQueryResult {
  const filtered = filterReorderItems(items, params)
  const sorted = sortReorderItems(
    filtered,
    params.sortBy ?? 'daysOfCover',
    params.sortDir ?? 'asc',
  )
  return paginateReorderItems(sorted, params.page ?? 1, params.pageSize ?? 10)
}

export function selectionState(
  visibleIds: string[],
  selected: Set<string>,
): SelectionState {
  if (visibleIds.length === 0) return 'none'
  const selectedVisible = visibleIds.filter((id) => selected.has(id))
  if (selectedVisible.length === 0) return 'none'
  if (selectedVisible.length === visibleIds.length) return 'all'
  return 'indeterminate'
}

export function estimateSelectedCost(
  items: ReorderSuggestion[],
  selected: Set<string>,
  finalQtyById: Record<string, number>,
): number {
  return items.reduce((sum, item) => {
    if (!selected.has(item.id)) return sum
    const qty = finalQtyById[item.id] ?? item.suggestedQty
    return sum + Math.max(0, qty) * item.unitCost
  }, 0)
}

export function groupSubtotalsByDistributor(
  items: ReorderSuggestion[],
  selected: Set<string>,
  finalQtyById: Record<string, number>,
): DistributorSubtotal[] {
  const map = new Map<string, DistributorSubtotal>()
  for (const item of items) {
    if (!selected.has(item.id)) continue
    const qty = finalQtyById[item.id] ?? item.suggestedQty
    const existing = map.get(item.distributorId)
    if (existing) {
      existing.itemCount += 1
      existing.quantities += qty
      existing.estimatedCost += qty * item.unitCost
    } else {
      map.set(item.distributorId, {
        distributorId: item.distributorId,
        distributorNameFa: item.distributorNameFa,
        itemCount: 1,
        quantities: qty,
        estimatedCost: qty * item.unitCost,
      })
    }
  }
  return [...map.values()].sort((a, b) =>
    a.distributorNameFa.localeCompare(b.distributorNameFa, 'fa'),
  )
}
