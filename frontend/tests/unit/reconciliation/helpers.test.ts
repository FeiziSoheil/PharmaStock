import { describe, expect, it } from 'vitest'
import {
  canConfirmReconciliation,
  countMappedFields,
  filterReconciledRows,
  formatPriceVarianceFa,
  rowNeedsAction,
} from '@/lib/reconciliation/helpers'
import type {
  ColumnMapping,
  PurchaseReconciliation,
  ReconciledRow,
} from '@/lib/types/reconciliation'

const SAMPLE_ROWS: ReconciledRow[] = [
  {
    id: 'r1',
    rowNumber: 1,
    excelName: 'قرص متفورمین ۵۰۰',
    gtin: '6260152401123',
    batchNo: 'M9041',
    expiryRaw: '1405/02/15',
    expiryISO: '2026-05-05',
    quantity: 100,
    unitLabel: 'جعبه',
    buyPriceRial: 450000,
    approvedPriceRial: 450000,
    drugId: 'drug-met',
    catalogNameFa: 'قرص متفورمین 500mg',
    matchStatus: 'matched',
  },
  {
    id: 'r2',
    rowNumber: 2,
    excelName: 'کپسول دوکسوروبیسین ۵۰',
    gtin: '6268800109924',
    batchNo: 'DOX-204',
    expiryRaw: '1405/10/20',
    expiryISO: '2027-01-10',
    quantity: 30,
    unitLabel: 'ویال',
    buyPriceRial: 1850000,
    matchStatus: 'new_item',
  },
  {
    id: 'r3',
    rowNumber: 3,
    excelName: 'سرم رینگر ۱۰۰۰',
    gtin: '6260233000194',
    batchNo: 'RNG-9980',
    expiryRaw: '1404/11/20',
    expiryISO: '2026-02-09',
    quantity: 80,
    unitLabel: 'عدد',
    buyPriceRial: 185000,
    approvedPriceRial: 180000,
    priceDiffPct: 2.8,
    drugId: 'drug-rng',
    catalogNameFa: 'محلول تزریقی رینگر',
    matchStatus: 'price_mismatch',
    priceApproved: false,
  },
]

describe('reconciliation helpers', () => {
  it('counts mapped columns', () => {
    const mapping: ColumnMapping = {
      nameFa: 1,
      gtin: 2,
      irc: 3,
      batchNo: 4,
      expiry: 5,
      quantity: 6,
      buyPriceRial: 7,
      consumerPriceRial: -1,
      unitLabel: -1,
    }
    expect(countMappedFields(mapping)).toBe(7)
  })

  it('identifies rows needing action vs matched', () => {
    expect(rowNeedsAction(SAMPLE_ROWS[0]!)).toBe(false)
    expect(rowNeedsAction(SAMPLE_ROWS[1]!)).toBe(true)
    expect(rowNeedsAction(SAMPLE_ROWS[2]!)).toBe(true)
    expect(
      rowNeedsAction({ ...SAMPLE_ROWS[2]!, priceApproved: true }),
    ).toBe(false)
  })

  it('filters by status tab and Persian/Latin search query', () => {
    expect(filterReconciledRows(SAMPLE_ROWS, 'all')).toHaveLength(3)
    expect(filterReconciledRows(SAMPLE_ROWS, 'action_needed')).toHaveLength(2)
    expect(filterReconciledRows(SAMPLE_ROWS, 'matched')).toHaveLength(1)
    expect(filterReconciledRows(SAMPLE_ROWS, 'new_item')).toHaveLength(1)
    expect(filterReconciledRows(SAMPLE_ROWS, 'price_mismatch')).toHaveLength(1)
    expect(filterReconciledRows(SAMPLE_ROWS, 'all', 'DOX-204')).toHaveLength(1)
    expect(filterReconciledRows(SAMPLE_ROWS, 'all', 'متفورمين')).toHaveLength(1)
  })

  it('formats price variance with Persian digits', () => {
    expect(formatPriceVarianceFa(2.7)).toBe('+۲.۷٪')
    expect(formatPriceVarianceFa(-1.5)).toBe('-۱.۵٪')
    expect(formatPriceVarianceFa(0)).toBe('')
  })

  it('gates final confirmation until new items and price mismatches are resolved', () => {
    const base: PurchaseReconciliation = {
      id: 'rec-1',
      status: 'mapped',
      currentStep: 3,
      fileName: 'test.xlsx',
      fileSizeBytes: 1200,
      invoiceNo: 'INV-1',
      distributor: 'پخش هجرت',
      issuedAt: '2026-11-10',
      receivedAt: '2026-11-11',
      warehouseLabel: 'انبار مرکزی',
      discountRial: 0,
      vatRial: 0,
      templateId: 'hijrat',
      headers: [],
      columnLabels: [],
      mapping: {
        nameFa: 1,
        gtin: 2,
        irc: 3,
        batchNo: 4,
        expiry: 5,
        quantity: 6,
        buyPriceRial: 7,
        consumerPriceRial: 8,
        unitLabel: -1,
      },
      rows: SAMPLE_ROWS,
      quarantineOnIntake: true,
      createdBy: { userId: 'u1', name: 'اپراتور', role: 'warehouse_operator' },
      createdAt: '',
      updatedAt: '',
      summary: {
        totalRows: 3,
        matchedCount: 1,
        matchedPercent: 33,
        newItemCount: 1,
        priceMismatchCount: 1,
        unapprovedMismatchCount: 1,
        grossRial: 0,
        discountRial: 0,
        vatRial: 0,
        netRial: 0,
        canConfirm: false,
      },
    }

    expect(canConfirmReconciliation(base)).toBe(false)

    const resolved: PurchaseReconciliation = {
      ...base,
      rows: [
        SAMPLE_ROWS[0]!,
        { ...SAMPLE_ROWS[2]!, priceApproved: true },
      ],
    }
    expect(canConfirmReconciliation(resolved)).toBe(true)
    expect(canConfirmReconciliation({ ...resolved, status: 'confirmed' })).toBe(
      false,
    )
  })
})
