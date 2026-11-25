import { describe, expect, it } from 'vitest'
import {
  applyDrugQuery,
  deriveStockStatus,
  filterDrugs,
  paginateDrugs,
  sortDrugs,
} from '@/lib/drugs/catalog-query'
import type { Drug } from '@/lib/types/drugs'
import { FIXTURE_DRUGS as MOCK_DRUGS } from '../../fixtures/mock-drugs-data'
import { normalizePersianText } from '@/lib/persian'

const FIXED_NOW = new Date('2025-11-11T12:00:00Z')

function sample(overrides: Partial<Drug> = {}): Drug {
  return {
    id: 't-1',
    nameFa: 'استامینوفن',
    brandName: 'استامینوفن بهاء',
    dosageForm: 'قرص',
    strength: '۵۰۰ میلی‌گرم',
    gtin: '06260100024501',
    genericCode: '122801000245011',
    manufacturer: 'بهاء',
    category: 'مسکن و ضدالتهاب',
    isControlled: false,
    totalStock: 100,
    reorderLevel: 50,
    nearestExpiry: '2027-01-01',
    ...overrides,
  }
}

describe('normalizePersianText', () => {
  it('equates Arabic/Persian yeh and kaf and digit scripts', () => {
    expect(normalizePersianText('يك ۱۲۳')).toBe(normalizePersianText('یک 123'))
    expect(normalizePersianText('كپسول')).toBe(normalizePersianText('کپسول'))
  })
})

describe('deriveStockStatus', () => {
  it('marks zero stock as critical', () => {
    expect(deriveStockStatus(sample({ totalStock: 0 }), FIXED_NOW)).toBe('critical')
  })

  it('marks near-expiry ahead of low-stock when stock remains', () => {
    expect(
      deriveStockStatus(
        sample({ totalStock: 10, reorderLevel: 50, nearestExpiry: '2025-12-01' }),
        FIXED_NOW,
      ),
    ).toBe('expiring')
  })

  it('marks below reorder as warning when not expiring', () => {
    expect(
      deriveStockStatus(
        sample({ totalStock: 20, reorderLevel: 50, nearestExpiry: '2027-06-01' }),
        FIXED_NOW,
      ),
    ).toBe('warning')
  })

  it('marks healthy stock as valid', () => {
    expect(
      deriveStockStatus(
        sample({ totalStock: 200, reorderLevel: 50, nearestExpiry: '2027-06-01' }),
        FIXED_NOW,
      ),
    ).toBe('valid')
  })
})

describe('filterDrugs', () => {
  it('searches by Persian name with yeh normalization', () => {
    const rows = [
      sample({ id: '1', nameFa: 'متفورمین هیدروکلراید' }),
      sample({ id: '2', nameFa: 'آموکسی‌سیلین' }),
    ]
    const found = filterDrugs(rows, { search: 'متفورمين' })
    expect(found.map((row) => row.id)).toEqual(['1'])
  })

  it('searches brand, generic code, and GTIN with digit equivalence', () => {
    const rows = [sample({ id: '1', gtin: '06260100024501', brandName: 'Glucophage' })]
    expect(filterDrugs(rows, { search: '۰۶۲۶۰۱۰۰۰۲۴۵۰۱' })).toHaveLength(1)
    expect(filterDrugs(rows, { search: 'glucophage' })).toHaveLength(1)
    expect(filterDrugs(rows, { search: '122801000245011' })).toHaveLength(1)
  })

  it('filters by dosage form, category, controlled flag, and stock status', () => {
    const rows = [
      sample({
        id: 'c',
        dosageForm: 'آمپول',
        category: 'تحت کنترل / مخدر',
        isControlled: true,
        totalStock: 0,
        nearestExpiry: '2027-01-01',
      }),
      sample({
        id: 'o',
        dosageForm: 'قرص',
        category: 'مسکن و ضدالتهاب',
        isControlled: false,
        totalStock: 200,
        nearestExpiry: '2027-01-01',
      }),
    ]

    expect(
      filterDrugs(rows, {
        dosageForm: 'آمپول',
        category: 'تحت کنترل / مخدر',
        isControlled: true,
        stockStatus: 'critical',
        now: FIXED_NOW,
      }).map((row) => row.id),
    ).toEqual(['c'])
  })
})

describe('sortDrugs', () => {
  it('defaults to Persian name ascending', () => {
    const rows = [
      sample({ id: 'b', nameFa: 'بروفن' }),
      sample({ id: 'a', nameFa: 'آموکسی‌سیلین' }),
      sample({ id: 'm', nameFa: 'متفورمین' }),
    ]
    expect(sortDrugs(rows).map((row) => row.id)).toEqual(['a', 'b', 'm'])
  })

  it('sorts total stock descending', () => {
    const rows = [
      sample({ id: 'lo', totalStock: 10 }),
      sample({ id: 'hi', totalStock: 90 }),
    ]
    expect(sortDrugs(rows, 'totalStock', 'desc').map((row) => row.id)).toEqual([
      'hi',
      'lo',
    ])
  })
})

describe('paginateDrugs', () => {
  it('paginates with page sizes 10/25/50', () => {
    const rows = MOCK_DRUGS
    const page1 = paginateDrugs(rows, 1, 10)
    expect(page1.items).toHaveLength(10)
    expect(page1.pageCount).toBe(Math.ceil(rows.length / 10))

    const page2 = paginateDrugs(rows, 2, 25)
    expect(page2.items).toHaveLength(Math.min(25, Math.max(0, rows.length - 25)))
    expect(page2.page).toBe(2)
  })
})

describe('applyDrugQuery', () => {
  it('composes filter + sort + pagination over mock catalog', () => {
    const result = applyDrugQuery(MOCK_DRUGS, {
      search: 'انسولین',
      sortBy: 'nameFa',
      sortDir: 'asc',
      page: 1,
      pageSize: 10,
      now: FIXED_NOW,
    })
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((row) => row.nameFa.includes('انسولین'))).toBe(true)
    expect(result.items).toEqual(
      [...result.items].sort((a, b) =>
        a.nameFa.localeCompare(b.nameFa, 'fa', { sensitivity: 'base' }),
      ),
    )
  })

  it('filters controlled substances', () => {
    const result = applyDrugQuery(MOCK_DRUGS, {
      isControlled: true,
      pageSize: 50,
      now: FIXED_NOW,
    })
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((row) => row.isControlled)).toBe(true)
  })
})
