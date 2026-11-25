import { describe, expect, it } from 'vitest'
import { validateOrderQuantity } from '@/lib/reorder/quantity-validation'

describe('validateOrderQuantity', () => {
  it('accepts pack-aligned non-negative integers', () => {
    expect(validateOrderQuantity('60', 10)).toEqual({ ok: true, value: 60 })
    expect(validateOrderQuantity('۰', 10)).toEqual({ ok: true, value: 0 })
  })

  it('rejects negatives, non-integers, and non-multiples', () => {
    expect(validateOrderQuantity('-1', 10).ok).toBe(false)
    expect(validateOrderQuantity('12.5', 10).ok).toBe(false)
    expect(validateOrderQuantity('15', 10).ok).toBe(false)
  })
})
