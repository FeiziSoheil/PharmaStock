import { describe, expect, it } from 'vitest'
import {
  canAdvanceToStep3,
  canConfirmReceipt,
  computeReceiptTotals,
} from '@/lib/receipts/totals'
import type { InvoiceReceipt, ReceiptLine } from '@/lib/types/receipts'

const line = (over: Partial<ReceiptLine> = {}): ReceiptLine => ({
  id: 'l1',
  drugId: 'drug-amox',
  nameFa: 'آموکسی‌سیلین',
  batchNo: 'B1',
  expiry: '2027-01-01',
  quantity: 10,
  unitLabel: 'عدد',
  buyPriceRial: 1000,
  ...over,
})

describe('computeReceiptTotals', () => {
  it('computes gross and net', () => {
    expect(
      computeReceiptTotals(
        [line({ quantity: 10, buyPriceRial: 1000 }), line({ id: 'l2', quantity: 5, buyPriceRial: 2000 })],
        1500,
        0,
      ),
    ).toEqual({ grossRial: 20000, discountRial: 1500, vatRial: 0, netRial: 18500 })
  })
})

describe('canConfirmReceipt', () => {
  it('requires shelf on every line', () => {
    const base: InvoiceReceipt = {
      id: 'r1',
      status: 'draft',
      currentStep: 3,
      header: {
        invoiceNo: 'F-1',
        distributor: 'پخش',
        issuedAt: '2024-11-11',
        receivedAt: '2024-11-11',
        warehouseLabel: 'مرکزی',
        purchaseType: 'official_ttac',
        discountRial: 0,
        vatRial: 0,
      },
      lines: [line({ locationLabel: 'B-12' })],
      createdBy: { userId: 'u1', name: 'اپراتور', role: 'warehouse_operator' },
      createdAt: '',
      updatedAt: '',
    }
    expect(canConfirmReceipt(base)).toBe(true)
    expect(canConfirmReceipt({ ...base, lines: [line()] })).toBe(false)
  })
})

describe('canAdvanceToStep3', () => {
  it('needs at least one complete line', () => {
    expect(canAdvanceToStep3([])).toBe(false)
    expect(canAdvanceToStep3([line()])).toBe(true)
  })
})
