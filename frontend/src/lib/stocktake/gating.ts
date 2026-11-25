import { normalizePersianText } from '@/lib/persian'
import type {
  StocktakeItem,
  StocktakeVarianceFilter,
} from '@/lib/types/stocktake'

export function parseNonNegativeCount(raw: string): number | null {
  const normalized = normalizePersianText(raw).replace(/[,،\s]/g, '')
  if (!/^\d+$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isSafeInteger(value) || value < 0) return null
  return value
}

export function matchesStocktakeSearch(
  item: StocktakeItem,
  rawQuery: string,
): boolean {
  const q = normalizePersianText(rawQuery).toLowerCase()
  if (!q) return true
  const haystack = [
    item.nameFa,
    item.nameEn ?? '',
    item.gtin ?? '',
    item.genericCode ?? '',
    item.batchNo,
    item.locationLabel,
    item.manufacturer ?? '',
  ]
    .map((v) => normalizePersianText(v).toLowerCase())
    .join(' ')
  return haystack.includes(q)
}

export function filterStocktakeItems(
  items: readonly StocktakeItem[],
  filter: StocktakeVarianceFilter,
  searchQuery = '',
): StocktakeItem[] {
  return items.filter((item) => {
    if (!matchesStocktakeSearch(item, searchQuery)) return false
    switch (filter) {
      case 'shortage':
        return item.varianceType === 'shortage'
      case 'surplus':
        return item.varianceType === 'surplus'
      case 'match':
        return item.varianceType === 'match'
      case 'uncounted':
        return (
          item.countStatus === 'pending' || item.countStatus === 'skipped'
        )
      case 'all':
      default:
        return true
    }
  })
}

export function pickNextPendingItemId(
  items: readonly StocktakeItem[],
  afterItemId?: string,
): string | null {
  if (items.length === 0) return null
  const startIdx = afterItemId
    ? items.findIndex((item) => item.id === afterItemId)
    : -1

  // 1. Search pending items after current index, then wrap around
  for (let offset = 1; offset <= items.length; offset++) {
    const candidate = items[(startIdx + offset) % items.length]
    if (candidate?.countStatus === 'pending') {
      return candidate.id
    }
  }
  // 2. Fallback to skipped items
  for (let offset = 1; offset <= items.length; offset++) {
    const candidate = items[(startIdx + offset) % items.length]
    if (candidate?.countStatus === 'skipped') {
      return candidate.id
    }
  }
  // 3. Fallback to next item or first item
  if (startIdx >= 0) {
    return items[(startIdx + 1) % items.length]?.id ?? items[0]?.id ?? null
  }
  return items[0]?.id ?? null
}

export function countFilterBuckets(items: readonly StocktakeItem[]): Record<
  StocktakeVarianceFilter,
  number
> {
  const counts: Record<StocktakeVarianceFilter, number> = {
    all: items.length,
    shortage: 0,
    surplus: 0,
    match: 0,
    uncounted: 0,
  }
  for (const item of items) {
    if (item.varianceType === 'shortage') counts.shortage++
    else if (item.varianceType === 'surplus') counts.surplus++
    else if (item.varianceType === 'match') counts.match++
    else counts.uncounted++
  }
  return counts
}
