import { describe, expect, it } from 'vitest'
import {
  applyReorderQuery,
  estimateSelectedCost,
  filterReorderItems,
  groupSubtotalsByDistributor,
  selectionState,
  sortReorderItems,
  type ReorderSuggestion,
} from '@/lib/reorder/reorder-query'

const TODAY = new Date('2025-11-11T12:00:00Z')

function row(
  partial: Partial<ReorderSuggestion> & Pick<ReorderSuggestion, 'id'>,
): ReorderSuggestion {
  return {
    drugId: partial.drugId ?? partial.id,
    nameFa: partial.nameFa ?? 'دارو',
    dosageForm: partial.dosageForm ?? 'قرص',
    strength: partial.strength ?? '۵۰۰ میلی‌گرم',
    irc: partial.irc ?? '1000',
    distributorId: partial.distributorId ?? 'daroupakhsh',
    distributorNameFa: partial.distributorNameFa ?? 'داروپخش',
    distributorNote: partial.distributorNote ?? '',
    category: partial.category ?? 'آنتی‌بیوتیک و ضدباکتری',
    isControlled: partial.isControlled ?? false,
    availableStock: partial.availableStock ?? 10,
    reorderPoint: partial.reorderPoint ?? 20,
    targetStock: partial.targetStock ?? 100,
    onOrderQuantity: partial.onOrderQuantity ?? 0,
    avgDailyUsage: partial.avgDailyUsage ?? 5,
    packSize: partial.packSize ?? 10,
    unitCost: partial.unitCost ?? 1000,
    unitLabel: partial.unitLabel ?? 'بسته',
    leadTimeDays: partial.leadTimeDays ?? 3,
    suggestedQty: partial.suggestedQty ?? 80,
    daysOfCover: partial.daysOfCover ?? 2,
    urgency: partial.urgency ?? 'critical',
    locationHint: partial.locationHint ?? 'قفسه A-01',
    status: partial.status ?? 'active',
    storageTemp: partial.storageTemp ?? 'room',
    ...partial,
  }
}

const SAMPLE: ReorderSuggestion[] = [
  row({
    id: 'r1',
    nameFa: 'وارفارین',
    distributorId: 'ferdows',
    distributorNameFa: 'پخش فردوس',
    urgency: 'critical',
    daysOfCover: 1.2,
    category: 'قلب و عروق',
    isControlled: false,
    unitCost: 50_000,
    suggestedQty: 60,
  }),
  row({
    id: 'r2',
    nameFa: 'انسولین گلارژین',
    distributorId: 'razi',
    distributorNameFa: 'رازی',
    urgency: 'low',
    daysOfCover: 3,
    category: 'دیابت و غدد',
    isControlled: false,
    unitCost: 200_000,
    suggestedQty: 70,
  }),
  row({
    id: 'r3',
    nameFa: 'مورفین سولفات',
    distributorId: 'daroupakhsh',
    distributorNameFa: 'داروپخش',
    urgency: 'reorder',
    daysOfCover: 8,
    category: 'تحت کنترل / مخدر',
    isControlled: true,
    unitCost: 80_000,
    suggestedQty: 20,
  }),
  row({
    id: 'r4',
    nameFa: 'متفورمین',
    distributorId: 'daroupakhsh',
    distributorNameFa: 'داروپخش',
    urgency: 'ok',
    daysOfCover: 20,
    category: 'دیابت و غدد',
    isControlled: false,
    unitCost: 10_000,
    suggestedQty: 40,
    status: 'order_drafted',
  }),
]

describe('filterReorderItems', () => {
  it('filters by distributor, category, urgency, controlled, and search', () => {
    expect(
      filterReorderItems(SAMPLE, { distributorId: 'daroupakhsh' }),
    ).toHaveLength(2)

    expect(
      filterReorderItems(SAMPLE, { category: 'دیابت و غدد' }),
    ).toHaveLength(2)

    expect(
      filterReorderItems(SAMPLE, { urgency: 'critical' }),
    ).toHaveLength(1)

    expect(
      filterReorderItems(SAMPLE, { isControlled: true }),
    ).toHaveLength(1)

    const byName = filterReorderItems(SAMPLE, { search: 'وارفارين' })
    expect(byName).toHaveLength(1)
    expect(byName[0]?.id).toBe('r1')
  })

  it('excludes drafted rows by default when activeOnly', () => {
    expect(filterReorderItems(SAMPLE, { activeOnly: true })).toHaveLength(3)
  })
})

describe('sortReorderItems', () => {
  it('defaults to urgency / lowest days of cover first', () => {
    const sorted = sortReorderItems(SAMPLE, 'daysOfCover', 'asc')
    expect(sorted.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4'])
  })

  it('sorts by nameFa', () => {
    const sorted = sortReorderItems(SAMPLE, 'nameFa', 'asc')
    expect(sorted[0]?.nameFa).toBe('انسولین گلارژین')
  })
})

describe('selection + subtotals', () => {
  it('computes select-all / indeterminate / none', () => {
    expect(selectionState(['r1', 'r2'], new Set(['r1', 'r2']))).toBe('all')
    expect(selectionState(['r1', 'r2'], new Set(['r1']))).toBe('indeterminate')
    expect(selectionState(['r1', 'r2'], new Set())).toBe('none')
  })

  it('estimates selected cost using final quantities when provided', () => {
    const cost = estimateSelectedCost(SAMPLE, new Set(['r1', 'r3']), {
      r1: 60,
      r3: 20,
    })
    expect(cost).toBe(60 * 50_000 + 20 * 80_000)
  })

  it('groups selected rows by distributor with subtotals', () => {
    const groups = groupSubtotalsByDistributor(SAMPLE, new Set(['r1', 'r2', 'r3']), {
      r1: 60,
      r2: 70,
      r3: 20,
    })
    expect(groups).toHaveLength(3)
    const ferdows = groups.find((g) => g.distributorId === 'ferdows')
    expect(ferdows?.itemCount).toBe(1)
    expect(ferdows?.estimatedCost).toBe(60 * 50_000)
  })
})

describe('applyReorderQuery', () => {
  it('paginates filtered sorted results', () => {
    const result = applyReorderQuery(SAMPLE, {
      activeOnly: true,
      sortBy: 'daysOfCover',
      sortDir: 'asc',
      page: 1,
      pageSize: 2,
      now: TODAY,
    })
    expect(result.total).toBe(3)
    expect(result.items).toHaveLength(2)
    expect(result.pageCount).toBe(2)
    expect(result.items[0]?.id).toBe('r1')
  })
})
