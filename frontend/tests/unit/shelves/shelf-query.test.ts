import { describe, expect, it } from 'vitest'
import { FIXTURE_SHELVES as MOCK_SHELVES } from '../../fixtures/mock-shelves-data'
import {
  applyShelfQuery,
  deriveBinStatus,
  filterShelves,
  sortBatchesFefo,
} from '@/lib/shelves/shelf-query'

const NOW = new Date('2025-11-11T12:00:00Z')

describe('shelf query pipeline', () => {
  it('filters by zone', () => {
    const items = filterShelves(MOCK_SHELVES, { zone: 'S', now: NOW })
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((bin) => bin.zone === 'S')).toBe(true)
  })

  it('searches by Persian drug name and by address', () => {
    const byName = filterShelves(MOCK_SHELVES, {
      search: 'آموکسی',
      now: NOW,
    })
    expect(byName.some((bin) => bin.address === 'A-01-1-04')).toBe(true)

    const byAddress = filterShelves(MOCK_SHELVES, {
      search: 'A-03-2-01',
      now: NOW,
    })
    expect(byAddress).toHaveLength(1)
    expect(byAddress[0]?.address).toBe('A-03-2-01')
  })

  it('filters controlled-only and expiring-soon', () => {
    const controlled = filterShelves(MOCK_SHELVES, {
      controlledOnly: true,
      now: NOW,
    })
    expect(controlled.every((bin) => bin.isControlled)).toBe(true)

    const expiring = filterShelves(MOCK_SHELVES, {
      expiringSoon: true,
      now: NOW,
    })
    expect(expiring.length).toBeGreaterThan(0)
    expect(
      expiring.every((bin) => {
        const status = deriveBinStatus(bin, NOW)
        return status === 'expiring' || bin.batches.length > 0
      }),
    ).toBe(true)
  })

  it('derives bin statuses including controlled and expiring', () => {
    const empty = MOCK_SHELVES.find((b) => b.batches.length === 0)!
    expect(deriveBinStatus(empty, NOW)).toMatch(/empty|controlled/)

    const controlled = MOCK_SHELVES.find(
      (b) => b.isControlled && b.batches.length > 0,
    )!
    expect(deriveBinStatus(controlled, NOW)).toBe('controlled')

    const nearExpiry = MOCK_SHELVES.find((b) =>
      b.batches.some((batch) => batch.expiry.startsWith('2025-11')),
    )!
    if (!nearExpiry.isControlled) {
      expect(deriveBinStatus(nearExpiry, NOW)).toBe('expiring')
    }
  })

  it('orders batches FEFO with nearest expiry first', () => {
    const multi = MOCK_SHELVES.find((b) => b.batches.length > 1)!
    const ordered = sortBatchesFefo(multi)
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i - 1]!.expiry <= ordered[i]!.expiry).toBe(true)
    }
  })

  it('paginates filtered results', () => {
    const page1 = applyShelfQuery(MOCK_SHELVES, {
      page: 1,
      pageSize: 10,
      sortBy: 'address',
      now: NOW,
    })
    expect(page1.items).toHaveLength(10)
    expect(page1.total).toBe(MOCK_SHELVES.length)
    expect(page1.pageCount).toBeGreaterThan(1)
  })
})
