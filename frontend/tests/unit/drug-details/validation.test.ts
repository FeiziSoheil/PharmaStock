import { describe, expect, it } from 'vitest'
import { validateAddBatch } from '@/lib/drug-details/validation'

describe('validateAddBatch', () => {
  it('requires batchNo, expiry, quantity > 0, location', () => {
    const result = validateAddBatch({
      batchNo: '',
      productionISO: '2024-01-01',
      expiryISO: '',
      quantity: 0,
      buyPriceRial: 1,
      consumerPriceRial: 2,
      locationLabel: '',
      supplierLabel: 'x',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.batchNo).toMatch(/سری/)
      expect(result.errors.expiryISO).toBeTruthy()
      expect(result.errors.quantity).toBeTruthy()
      expect(result.errors.locationLabel).toBeTruthy()
    }
  })

  it('rejects expiry before production', () => {
    const result = validateAddBatch({
      batchNo: 'A1',
      productionISO: '2025-01-01',
      expiryISO: '2024-01-01',
      quantity: 5,
      buyPriceRial: 1000,
      consumerPriceRial: 1200,
      locationLabel: 'A-1',
      supplierLabel: 'پخش',
    })
    expect(result.ok).toBe(false)
  })
})
