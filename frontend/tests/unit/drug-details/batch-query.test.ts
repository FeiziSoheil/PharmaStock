import { describe, expect, it } from 'vitest'
import { applyBatchQuery, rankFefo } from '@/lib/drug-details/batch-query'
import type { DrugBatchRow } from '@/lib/drug-details/types'

const TODAY = '2026-11-11'

const rows: DrugBatchRow[] = [
  {
    id: 'b1',
    drugId: 'd-001',
    batchNo: 'M9041',
    productionISO: '2022-11-06',
    expiryISO: '2025-05-05',
    buyPriceRial: 120000,
    consumerPriceRial: 150000,
    quantity: 450,
    unitLabel: 'جعبه',
    locationLabel: 'قفسه A-12',
    supplierLabel: 'پخش هجرت',
    status: 'active',
  },
  {
    id: 'b2',
    drugId: 'd-001',
    batchNo: 'M9100',
    productionISO: '2024-01-01',
    expiryISO: '2027-01-01',
    buyPriceRial: 100000,
    consumerPriceRial: 130000,
    quantity: 0,
    unitLabel: 'جعبه',
    locationLabel: 'قفسه B-1',
    supplierLabel: 'داروپخش',
    status: 'active',
  },
  {
    id: 'b3',
    drugId: 'd-001',
    batchNo: 'Q1',
    productionISO: '2023-01-01',
    expiryISO: '2026-01-01',
    buyPriceRial: 110000,
    consumerPriceRial: 140000,
    quantity: 10,
    unitLabel: 'جعبه',
    locationLabel: 'قرنطینه',
    supplierLabel: 'داروپخش',
    status: 'quarantine',
  },
]

describe('rankFefo', () => {
  it('orders active in-stock by nearest expiry and skips quarantine/zero', () => {
    expect(rankFefo(rows, TODAY)).toEqual(['b1'])
  })
})

describe('applyBatchQuery', () => {
  it('filters in-stock', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'in-stock',
      q: '',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.total).toBe(2) // b1 + b3 still has qty; decide: quarantine still "in-stock" if qty>0
    // Spec chips: دارای موجودی = quantity > 0 (include quarantine)
    expect(result.rows.map((r) => r.id).sort()).toEqual(['b1', 'b3'])
  })

  it('filters quarantine', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'quarantine',
      q: '',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.rows.map((r) => r.id)).toEqual(['b3'])
  })

  it('searches batchNo case-insensitively', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'all',
      q: 'm9041',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.rows.map((r) => r.id)).toEqual(['b1'])
  })

  it('searches locationLabel case-insensitively', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'all',
      q: 'قفسه a-12',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.rows.map((r) => r.id)).toEqual(['b1'])
  })

  it('computes dispensable KPI excluding quarantine', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'all',
      q: '',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.kpis.dispensableQty).toBe(450)
    expect(result.kpis.fefoBatchNo).toBe('M9041')
  })
})
