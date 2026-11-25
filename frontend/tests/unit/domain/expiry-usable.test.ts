import { describe, expect, it } from 'vitest'
import {
  getExpiryBucket,
  sumUsableQuantity,
  type ExpiryBatchLike,
} from '@/lib/domain/expiry'

const TODAY = new Date('2025-11-11T12:00:00Z')

describe('getExpiryBucket (usable stock gate)', () => {
  it('marks past dates as expired so they must not count toward stock', () => {
    expect(getExpiryBucket('2025-11-01', TODAY)).toBe('expired')
  })

  it('keeps today and future dates out of the expired bucket', () => {
    expect(getExpiryBucket('2025-11-11', TODAY)).not.toBe('expired')
    expect(getExpiryBucket('2026-05-01', TODAY)).not.toBe('expired')
  })
})

describe('sumUsableQuantity', () => {
  it('excludes expired batches from available stock', () => {
    const batches: ExpiryBatchLike[] = [
      { quantity: 40, expiry: '2025-10-01' },
      { quantity: 25, expiry: '2026-06-01' },
      { quantity: 10, expiry: '2025-11-05' },
    ]
    expect(sumUsableQuantity(batches, TODAY)).toBe(25)
  })

  it('returns 0 when every batch is expired', () => {
    const batches: ExpiryBatchLike[] = [
      { quantity: 12, expiry: '2024-01-01' },
      { quantity: 8, expiry: '2025-11-10' },
    ]
    expect(sumUsableQuantity(batches, TODAY)).toBe(0)
  })
})
