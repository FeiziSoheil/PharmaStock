import { describe, expect, it } from 'vitest'
import { DEFAULT_REORDER_FORMULA } from '@/lib/types/reorder'
import {
  daysOfCover,
  needsReorder,
  suggestedQuantity,
  urgencyFromDaysOfCover,
} from '@/lib/domain/reorder'

describe('reorder formula domain enhancements', () => {
  it('has consistent default formula config', () => {
    expect(DEFAULT_REORDER_FORMULA.mode).toBe('drug_defaults')
    expect(DEFAULT_REORDER_FORMULA.safetyStockDays).toBe(3)
    expect(DEFAULT_REORDER_FORMULA.targetCoverageDays).toBe(14)
    expect(DEFAULT_REORDER_FORMULA.defaultBufferPct).toBe(10)
    expect(DEFAULT_REORDER_FORMULA.includeOnOrder).toBe(true)
    expect(DEFAULT_REORDER_FORMULA.roundToPackSize).toBe(true)
  })

  it('computes suggested order with dynamic target and pack size', () => {
    // Lead=5, Safety=3, Coverage=10 => target coverage days = 18. ADU = 4.
    // Target = 4 * 18 = 72. Available = 12. OnOrder = 0. Pack = 10.
    // Raw Need = 72 - 12 = 60 => multiple of 10 => 60.
    const qty = suggestedQuantity({
      availableStock: 12,
      reorderPoint: 32,
      targetStock: 72,
      onOrderQuantity: 0,
      avgDailyUsage: 4,
      packSize: 10,
    })
    expect(qty).toBe(60)
  })

  it('correctly reports needsReorder and urgency', () => {
    expect(
      needsReorder({
        availableStock: 25,
        reorderPoint: 30,
        targetStock: 80,
        onOrderQuantity: 0,
        avgDailyUsage: 5,
        packSize: 10,
      }),
    ).toBe(true)

    const doc = daysOfCover({
      availableStock: 10,
      reorderPoint: 20,
      targetStock: 60,
      onOrderQuantity: 0,
      avgDailyUsage: 5,
      packSize: 5,
    })
    expect(doc).toBe(2)
    expect(urgencyFromDaysOfCover(doc)).toBe('critical')
  })
})
