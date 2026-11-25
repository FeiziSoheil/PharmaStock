import { describe, expect, it } from 'vitest'
import {
  EXPIRY_THRESHOLDS,
  daysUntilExpiry,
  findFefoViolations,
  getExpiryBucket,
  hasFefoViolation,
} from '@/lib/domain/expiry'

/** Local calendar date — avoids TZ drift in day-boundary tests. */
function day(y: number, m: number, d: number) {
  return new Date(y, m - 1, d)
}

const TODAY = day(2026, 11, 11)

describe('getExpiryBucket', () => {
  it('classifies expired (< today)', () => {
    expect(getExpiryBucket('2026-11-10', TODAY)).toBe('expired')
    expect(getExpiryBucket('2025-01-01', TODAY)).toBe('expired')
  })

  it('treats today as critical (≤ criticalMaxDays)', () => {
    expect(getExpiryBucket('2026-11-11', TODAY)).toBe('critical')
    expect(daysUntilExpiry('2026-11-11', TODAY)).toBe(0)
  })

  it('includes exact critical threshold day', () => {
    expect(getExpiryBucket('2026-12-11', TODAY)).toBe('critical')
    expect(daysUntilExpiry('2026-12-11', TODAY)).toBe(
      EXPIRY_THRESHOLDS.criticalMaxDays,
    )
  })

  it('starts warning the day after critical max', () => {
    expect(getExpiryBucket('2026-12-12', TODAY)).toBe('warning')
  })

  it('includes exact warning threshold', () => {
    const expiry = new Date(TODAY)
    expiry.setDate(expiry.getDate() + EXPIRY_THRESHOLDS.warningMaxDays)
    const iso = `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`
    expect(getExpiryBucket(iso, TODAY)).toBe('warning')
  })

  it('classifies watch and ok around watchMaxDays', () => {
    const watchEdge = new Date(TODAY)
    watchEdge.setDate(watchEdge.getDate() + EXPIRY_THRESHOLDS.watchMaxDays)
    const watchIso = `${watchEdge.getFullYear()}-${String(watchEdge.getMonth() + 1).padStart(2, '0')}-${String(watchEdge.getDate()).padStart(2, '0')}`
    expect(getExpiryBucket(watchIso, TODAY)).toBe('watch')

    const okDay = new Date(TODAY)
    okDay.setDate(okDay.getDate() + EXPIRY_THRESHOLDS.watchMaxDays + 1)
    const okIso = `${okDay.getFullYear()}-${String(okDay.getMonth() + 1).padStart(2, '0')}-${String(okDay.getDate()).padStart(2, '0')}`
    expect(getExpiryBucket(okIso, TODAY)).toBe('ok')
  })

  it('returns null for invalid dates', () => {
    expect(getExpiryBucket('', TODAY)).toBeNull()
    expect(getExpiryBucket('not-a-date', TODAY)).toBeNull()
    expect(getExpiryBucket('2026-13-40', TODAY)).toBeNull()
    expect(daysUntilExpiry('bogus', TODAY)).toBeNull()
  })
})

describe('FEFO violation check', () => {
  it('detects newer batch listed ahead of older same-drug batch', () => {
    const list = [
      { drugId: 'd-006', batchId: 'new', expiryISO: '2027-12-01' },
      { drugId: 'd-006', batchId: 'old', expiryISO: '2026-11-20' },
    ]
    expect(hasFefoViolation(list)).toBe(true)
    expect(findFefoViolations(list)).toEqual([
      {
        drugId: 'd-006',
        aheadBatchId: 'new',
        behindBatchId: 'old',
      },
    ])
  })

  it('passes when list is FEFO-ordered', () => {
    const list = [
      { drugId: 'd-006', batchId: 'old', expiryISO: '2026-11-20' },
      { drugId: 'd-006', batchId: 'new', expiryISO: '2027-12-01' },
      { drugId: 'd-001', batchId: 'a', expiryISO: '2026-12-01' },
    ]
    expect(hasFefoViolation(list)).toBe(false)
    expect(findFefoViolations(list)).toEqual([])
  })
})
