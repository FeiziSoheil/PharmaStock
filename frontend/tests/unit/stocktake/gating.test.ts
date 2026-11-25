import { describe, expect, it } from 'vitest'
import {
  countFilterBuckets,
  filterStocktakeItems,
  matchesStocktakeSearch,
  parseNonNegativeCount,
  pickNextPendingItemId,
} from '@/lib/stocktake/gating'
import type { StocktakeItem } from '@/lib/types/stocktake'

function makeItem(overrides: Partial<StocktakeItem> = {}): StocktakeItem {
  return {
    id: 'item-1',
    batchId: 'batch-1',
    drugId: 'drug-1',
    nameFa: 'کپسول آموکسی‌سیلین ۵۰۰',
    nameEn: 'Amoxicillin 500mg',
    gtin: '6260001000001',
    genericCode: '12345',
    batchNo: 'AX-2401',
    expiry: '2026-12-01',
    zone: 'A',
    binId: 'bin-a1',
    locationLabel: 'A-03-2-04',
    unitLabel: 'عدد',
    isControlled: false,
    unitPriceRial: 32000,
    varianceType: 'pending',
    requiresSupervisor: false,
    countStatus: 'pending',
    supervisorVerified: false,
    ...overrides,
  }
}

describe('stocktake gating helpers', () => {
  it('parses Persian and English non-negative integer counts', () => {
    expect(parseNonNegativeCount('۰')).toBe(0)
    expect(parseNonNegativeCount('۲۴۰')).toBe(240)
    expect(parseNonNegativeCount('1,250')).toBe(1250)
    expect(parseNonNegativeCount('-5')).toBeNull()
    expect(parseNonNegativeCount('abc')).toBeNull()
    expect(parseNonNegativeCount('')).toBeNull()
  })

  it('matches GTIN, generic code, batch, location, and Persian drug name', () => {
    const item = makeItem()
    expect(matchesStocktakeSearch(item, '6260001000001')).toBe(true)
    expect(matchesStocktakeSearch(item, '12345')).toBe(true)
    expect(matchesStocktakeSearch(item, 'ax-2401')).toBe(true)
    expect(matchesStocktakeSearch(item, 'آموکسی')).toBe(true)
    expect(matchesStocktakeSearch(item, 'A-03-2')).toBe(true)
    expect(matchesStocktakeSearch(item, 'مورفین')).toBe(false)
  })

  it('filters items by variance bucket and computes bucket counts', () => {
    const items: StocktakeItem[] = [
      makeItem({ id: '1', varianceType: 'shortage', countStatus: 'counted' }),
      makeItem({ id: '2', varianceType: 'surplus', countStatus: 'counted' }),
      makeItem({ id: '3', varianceType: 'match', countStatus: 'counted' }),
      makeItem({ id: '4', varianceType: 'pending', countStatus: 'pending' }),
      makeItem({ id: '5', varianceType: 'skipped', countStatus: 'skipped' }),
    ]

    expect(countFilterBuckets(items)).toEqual({
      all: 5,
      shortage: 1,
      surplus: 1,
      match: 1,
      uncounted: 2,
    })

    expect(filterStocktakeItems(items, 'shortage').map((i) => i.id)).toEqual(['1'])
    expect(filterStocktakeItems(items, 'surplus').map((i) => i.id)).toEqual(['2'])
    expect(filterStocktakeItems(items, 'match').map((i) => i.id)).toEqual(['3'])
    expect(filterStocktakeItems(items, 'uncounted').map((i) => i.id)).toEqual([
      '4',
      '5',
    ])
  })

  it('picks next pending item after current, then falls back to skipped', () => {
    const items: StocktakeItem[] = [
      makeItem({ id: 'a', countStatus: 'counted', varianceType: 'match' }),
      makeItem({ id: 'b', countStatus: 'skipped', varianceType: 'skipped' }),
      makeItem({ id: 'c', countStatus: 'pending', varianceType: 'pending' }),
    ]
    expect(pickNextPendingItemId(items, 'a')).toBe('c')

    const onlySkipped: StocktakeItem[] = [
      makeItem({ id: 'a', countStatus: 'counted', varianceType: 'match' }),
      makeItem({ id: 'b', countStatus: 'skipped', varianceType: 'skipped' }),
    ]
    expect(pickNextPendingItemId(onlySkipped, 'a')).toBe('b')
  })
})
