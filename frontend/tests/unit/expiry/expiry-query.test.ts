import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyExpiryQuery,
  countExpiryBuckets,
  filterExpiryBatches,
  sortExpiryBatches,
} from '@/lib/expiry/expiry-query'
import { getExpiryBucket } from '@/lib/domain/expiry'
import {
  MOCK_EXPIRY_BATCHES,
  MOCK_EXPIRY_TODAY,
  getExpiryBatches,
  resetExpiryBatches,
  updateExpiryBatchStatus,
} from '../../fixtures/mock-expiry-data'

function mockToday() {
  const [y, m, d] = MOCK_EXPIRY_TODAY.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

describe('expiry-query', () => {
  beforeEach(() => {
    resetExpiryBatches()
  })

  it('defaults to FEFO sort (expiry ascending)', () => {
    const result = applyExpiryQuery(MOCK_EXPIRY_BATCHES, {
      today: mockToday(),
      pageSize: 50,
    })
    const expiries = result.items.map((row) => row.expiry)
    const sorted = [...expiries].sort((a, b) => a.localeCompare(b))
    expect(expiries).toEqual(sorted)
  })

  it('filters by bucket using the same getExpiryBucket as KPIs', () => {
    const today = mockToday()
    const critical = filterExpiryBatches(MOCK_EXPIRY_BATCHES, {
      bucket: 'critical',
      today,
    })
    expect(critical.length).toBeGreaterThan(0)
    expect(
      critical.every((row) => getExpiryBucket(row.expiry, today) === 'critical'),
    ).toBe(true)

    const kpis = countExpiryBuckets(MOCK_EXPIRY_BATCHES, today)
    expect(critical.length).toBe(kpis.critical)
  })

  it('allows ok KPI filter even when stageTab is all_alerts', () => {
    const today = mockToday()
    const ok = filterExpiryBatches(MOCK_EXPIRY_BATCHES, {
      bucket: 'ok',
      stageTab: 'all_alerts',
      today,
    })
    expect(ok.length).toBeGreaterThan(0)
    expect(ok.every((row) => getExpiryBucket(row.expiry, today) === 'ok')).toBe(
      true,
    )
  })

  it('keeps KPI counts consistent with full table bucket membership', () => {
    const today = mockToday()
    const kpis = countExpiryBuckets(MOCK_EXPIRY_BATCHES, today)
    const byBucket = {
      expired: 0,
      critical: 0,
      warning: 0,
      watch: 0,
      ok: 0,
    } as const
    const tallies = { ...byBucket }
    for (const row of MOCK_EXPIRY_BATCHES) {
      const bucket = getExpiryBucket(row.expiry, today)
      if (bucket) tallies[bucket] += 1
    }
    expect(kpis.expired).toBe(tallies.expired)
    expect(kpis.critical).toBe(tallies.critical)
    expect(kpis.warning).toBe(tallies.warning)
    expect(kpis.watch).toBe(tallies.watch)
    expect(kpis.ok).toBe(tallies.ok)
  })

  it('searches by drug name or batch number (Persian normalize)', () => {
    const today = mockToday()
    const byName = filterExpiryBatches(MOCK_EXPIRY_BATCHES, {
      search: 'سفتریاکسون',
      today,
    })
    expect(byName.some((row) => row.batchNo === 'B702-Jab')).toBe(true)

    const byBatch = filterExpiryBatches(MOCK_EXPIRY_BATCHES, {
      search: 'CX500-449',
      today,
    })
    expect(byBatch).toHaveLength(1)
    expect(byBatch[0]?.batchNo).toBe('CX500-449')
  })

  it('covers every expiry bucket in seeded mock data', () => {
    const today = mockToday()
    const kpis = countExpiryBuckets(MOCK_EXPIRY_BATCHES, today)
    expect(kpis.expired).toBeGreaterThan(0)
    expect(kpis.critical).toBeGreaterThan(0)
    expect(kpis.warning).toBeGreaterThan(0)
    expect(kpis.watch).toBeGreaterThan(0)
    expect(kpis.ok).toBeGreaterThan(0)
    expect(
      MOCK_EXPIRY_BATCHES.some((row) => row.isControlled && getExpiryBucket(row.expiry, today) === 'expired'),
    ).toBe(true)
  })

  it('sorts by name when requested (can break FEFO order)', () => {
    const sorted = sortExpiryBatches(MOCK_EXPIRY_BATCHES, 'nameFa', 'asc')
    expect(sorted[0]?.nameFa.localeCompare(sorted[1]?.nameFa ?? '', 'fa')).toBeLessThanOrEqual(
      0,
    )
  })

  it('getExpiryBatches updates status and refreshes KPI-visible rows', async () => {
    const today = mockToday()
    const before = await getExpiryBatches({ today, pageSize: 50 })
    const target = before.items.find((row) => row.batchNo === 'B702-Jab')
    expect(target).toBeTruthy()

    await updateExpiryBatchStatus(target!.batchId, 'quarantined')
    const after = await getExpiryBatches({ today, pageSize: 50, search: 'B702' })
    expect(after.items[0]?.status).toBe('quarantined')
  })
})
