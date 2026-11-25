import { describe, expect, it } from 'vitest'
import {
  buildSelectedDistributorDrafts,
  clampReturnQuantity,
  computeGroupSelectionSummary,
  defaultSelectedUrgentBatchIds,
  toCreateReturnPayloads,
} from '@/lib/returns/selection'
import type { DistributorReturnGroup } from '@/lib/types/returns'

const GROUPS: DistributorReturnGroup[] = [
  {
    distributorId: 'daroupakhsh',
    distributorName: 'شرکت توزیع داروپخش',
    distributorCode: 'DP-9411',
    customerCode: 'DP-CUST-88401',
    visitorName: 'مهندس کاظمی',
    depositLocation: 'B-12',
    batchCount: 2,
    totalQty: 30,
    totalValueRial: 3800000,
    nearestDays: 12,
    nearestExpiry: '2026-11-24',
    items: [
      {
        batchId: 'b1',
        drugId: 'd1',
        nameFa: 'کپسول سفالکسین',
        dosageForm: 'کپسول',
        strength: '500mg',
        manufacturer: 'دانا',
        irc: '14029831',
        batchNo: 'CX-1',
        expiry: '2026-11-24',
        daysUntilExpiry: 12,
        quantity: 20,
        unitLabel: 'جعبه',
        buyPriceRial: 100000,
        totalValueRial: 2000000,
        status: 'active',
        locationLabel: 'A-01',
        distributorId: 'daroupakhsh',
        distributorName: 'شرکت توزیع داروپخش',
        contractReason: 'بازه فوری',
        urgency: 'urgent',
        isControlled: false,
      },
      {
        batchId: 'b2',
        drugId: 'd2',
        nameFa: 'آمپول دگزامتازون',
        dosageForm: 'آمپول',
        strength: '8mg',
        manufacturer: 'سینادارو',
        irc: '450112',
        batchNo: 'DX-2',
        expiry: '2027-01-10',
        daysUntilExpiry: 59,
        quantity: 10,
        unitLabel: 'ویال',
        buyPriceRial: 180000,
        totalValueRial: 1800000,
        status: 'marked_return',
        locationLabel: 'A-02',
        distributorId: 'daroupakhsh',
        distributorName: 'شرکت توزیع داروپخش',
        contractReason: 'نشان‌شده',
        urgency: 'golden',
        isControlled: false,
      },
    ],
  },
  {
    distributorId: 'razi',
    distributorName: 'شرکت پخش رازی',
    distributorCode: 'RZ-440',
    customerCode: 'RZ-CUST-31908',
    visitorName: 'آقای محمدی',
    depositLocation: 'A-02',
    batchCount: 1,
    totalQty: 5,
    totalValueRial: 450000,
    nearestDays: 75,
    nearestExpiry: '2027-01-26',
    items: [
      {
        batchId: 'b3',
        drugId: 'd3',
        nameFa: 'قرص آتورواستاتین',
        dosageForm: 'قرص',
        strength: '20mg',
        manufacturer: 'سبحان',
        irc: '13991109',
        batchNo: 'AT-3',
        expiry: '2027-01-26',
        daysUntilExpiry: 75,
        quantity: 5,
        unitLabel: 'جعبه',
        buyPriceRial: 90000,
        totalValueRial: 450000,
        status: 'active',
        locationLabel: 'A-03',
        distributorId: 'razi',
        distributorName: 'شرکت پخش رازی',
        contractReason: 'پایش فعال',
        urgency: 'golden',
        isControlled: false,
      },
    ],
  },
]

describe('returns selection helpers', () => {
  it('clamps return quantities between 1 and available stock', () => {
    expect(clampReturnQuantity(0, 10)).toBe(1)
    expect(clampReturnQuantity(-5, 10)).toBe(1)
    expect(clampReturnQuantity(25, 10)).toBe(10)
    expect(clampReturnQuantity(4.9, 10)).toBe(4)
  })

  it('auto-selects urgent and marked_return items by default', () => {
    const defaults = defaultSelectedUrgentBatchIds(GROUPS)
    expect(defaults.has('b1')).toBe(true)
    expect(defaults.has('b2')).toBe(true)
    expect(defaults.has('b3')).toBe(false)
  })

  it('computes per-group selection summary and overrides accurately', () => {
    const selected = new Set(['b1'])
    const overrides = { b1: { quantity: 5 } }
    const summary = computeGroupSelectionSummary(GROUPS[0]!, selected, overrides)
    expect(summary).toEqual({
      selectedCount: 1,
      totalQty: 5,
      totalValueRial: 500000,
      allSelected: false,
      someSelected: true,
    })
  })

  it('builds per-distributor drafts and API payloads cleanly', () => {
    const selected = new Set(['b1', 'b3'])
    const overrides = { b1: { quantity: 3 } }
    const drafts = buildSelectedDistributorDrafts(GROUPS, selected, overrides)
    expect(drafts).toHaveLength(2)
    expect(drafts[0]?.totalQty).toBe(3)
    expect(drafts[0]?.totalValueRial).toBe(300000)
    expect(drafts[1]?.totalQty).toBe(5)

    const payloads = toCreateReturnPayloads(drafts, 90, 'تحویل به موزع')
    expect(payloads).toEqual([
      {
        distributorId: 'daroupakhsh',
        windowDays: 90,
        visitorName: 'مهندس کاظمی',
        note: 'تحویل به موزع',
        lines: [{ batchId: 'b1', quantity: 3, reason: 'بازه فوری' }],
      },
      {
        distributorId: 'razi',
        windowDays: 90,
        visitorName: 'آقای محمدی',
        note: 'تحویل به موزع',
        lines: [{ batchId: 'b3', quantity: 5, reason: 'پایش فعال' }],
      },
    ])
  })
})
