import { describe, expect, it } from 'vitest'
import {
  daysOfCover,
  needsReorder,
  roundUpToPackSize,
  suggestedQuantity,
  urgencyFromDaysOfCover,
  type ReorderItemInput,
} from '@/lib/domain/reorder'

function item(partial: Partial<ReorderItemInput> = {}): ReorderItemInput {
  return {
    availableStock: 20,
    reorderPoint: 30,
    targetStock: 100,
    onOrderQuantity: 0,
    avgDailyUsage: 5,
    packSize: 10,
    ...partial,
  }
}

describe('needsReorder', () => {
  it('is true when availableStock is at or below reorderPoint', () => {
    expect(needsReorder(item({ availableStock: 30, reorderPoint: 30 }))).toBe(
      true,
    )
    expect(needsReorder(item({ availableStock: 10, reorderPoint: 30 }))).toBe(
      true,
    )
  })

  it('is false when availableStock is above reorderPoint', () => {
    expect(needsReorder(item({ availableStock: 31, reorderPoint: 30 }))).toBe(
      false,
    )
  })
})

describe('suggestedQuantity', () => {
  it('computes max(0, target - available - onOrder) rounded up to pack size', () => {
    // 100 - 20 - 0 = 80 → already multiple of 10
    expect(suggestedQuantity(item())).toBe(80)
  })

  it('rounds up to the next pack-size multiple', () => {
    // 100 - 25 - 0 = 75 → ceil to 80 when packSize=10
    expect(suggestedQuantity(item({ availableStock: 25, packSize: 10 }))).toBe(
      80,
    )
  })

  it('accounts for quantity already on order', () => {
    // 100 - 20 - 40 = 40
    expect(suggestedQuantity(item({ onOrderQuantity: 40 }))).toBe(40)
  })

  it('never returns a negative quantity', () => {
    expect(
      suggestedQuantity(
        item({
          availableStock: 90,
          onOrderQuantity: 50,
          targetStock: 100,
          packSize: 10,
        }),
      ),
    ).toBe(0)
  })

  it('returns 0 when packSize is zero or negative (guard)', () => {
    expect(suggestedQuantity(item({ packSize: 0 }))).toBe(0)
    expect(suggestedQuantity(item({ packSize: -5 }))).toBe(0)
  })
})

describe('roundUpToPackSize', () => {
  it('rounds positive quantities up to pack multiples', () => {
    expect(roundUpToPackSize(1, 10)).toBe(10)
    expect(roundUpToPackSize(10, 10)).toBe(10)
    expect(roundUpToPackSize(11, 12)).toBe(12)
  })

  it('returns 0 for non-positive inputs', () => {
    expect(roundUpToPackSize(0, 10)).toBe(0)
    expect(roundUpToPackSize(-3, 10)).toBe(0)
  })
})

describe('daysOfCover', () => {
  it('divides available stock by average daily usage', () => {
    expect(daysOfCover(item({ availableStock: 42, avgDailyUsage: 6 }))).toBe(7)
  })

  it('returns Infinity when usage is zero (guard)', () => {
    expect(daysOfCover(item({ availableStock: 10, avgDailyUsage: 0 }))).toBe(
      Number.POSITIVE_INFINITY,
    )
  })

  it('returns 0 when stock is zero even with usage', () => {
    expect(daysOfCover(item({ availableStock: 0, avgDailyUsage: 4 }))).toBe(0)
  })
})

describe('urgencyFromDaysOfCover', () => {
  it('classifies critical / low / reorder / ok thresholds', () => {
    expect(urgencyFromDaysOfCover(0)).toBe('critical')
    expect(urgencyFromDaysOfCover(1.2)).toBe('critical')
    expect(urgencyFromDaysOfCover(3)).toBe('low')
    expect(urgencyFromDaysOfCover(7)).toBe('reorder')
    expect(urgencyFromDaysOfCover(20)).toBe('ok')
    expect(urgencyFromDaysOfCover(Number.POSITIVE_INFINITY)).toBe('ok')
  })
})
