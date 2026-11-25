import { describe, expect, it } from 'vitest'
import {
  canAdvanceToStep2,
  canConfirmTransfer,
  remainingBatchQuantity,
  stagedQuantityForBatch,
  sumTransferUnits,
} from '@/lib/transfers/gating'
import type { InternalTransfer, TransferLine } from '@/lib/types/transfers'

const line = (over: Partial<TransferLine> = {}): TransferLine => ({
  id: 'l1',
  drugId: 'drug-amox',
  nameFa: 'آموکسی‌سیلین',
  batchNo: 'B1',
  expiry: '2027-01-01',
  sourceBatchId: 'batch-1',
  sourceLocationLabel: 'سالن A > قفسه 02',
  quantity: 10,
  unitLabel: 'بسته',
  matchStatus: 'barcode',
  ...over,
})

const draft = (over: Partial<InternalTransfer> = {}): InternalTransfer => ({
  id: 't1',
  status: 'draft',
  currentStep: 1,
  header: {
    reason: 'routine_front',
    sourceZone: 'warehouse',
    destZone: 'dispensing',
    sourceLabel: 'انبار مرکزی',
    destLabel: 'پیشخوان نسخه‌پیچی',
  },
  lines: [line({ destLocationLabel: 'پیشخوان 2 > استند B' })],
  createdBy: { userId: 'u1', name: 'اپراتور', role: 'warehouse_operator' },
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('sumTransferUnits', () => {
  it('sums quantities and ignores non-finite values', () => {
    expect(
      sumTransferUnits([
        line({ quantity: 10 }),
        line({ id: 'l2', quantity: 5 }),
        line({ id: 'l3', quantity: Number.NaN }),
      ]),
    ).toBe(15)
  })
})

describe('stagedQuantityForBatch & remainingBatchQuantity', () => {
  it('computes staged and remaining quantities per batch', () => {
    const lines = [
      line({ id: 'l1', sourceBatchId: 'b1', quantity: 4 }),
      line({ id: 'l2', sourceBatchId: 'b1', quantity: 3 }),
      line({ id: 'l3', sourceBatchId: 'b2', quantity: 5 }),
    ]
    expect(stagedQuantityForBatch(lines, 'b1')).toBe(7)
    expect(stagedQuantityForBatch(lines, 'b1', 'l1')).toBe(3)
    expect(remainingBatchQuantity(10, lines, 'b1')).toBe(3)
    expect(remainingBatchQuantity(5, lines, 'b1')).toBe(0)
  })
})

describe('canAdvanceToStep2', () => {
  it('needs at least one complete source line with finite positive qty', () => {
    expect(canAdvanceToStep2([])).toBe(false)
    expect(canAdvanceToStep2([line({ quantity: 0 })])).toBe(false)
    expect(canAdvanceToStep2([line({ quantity: Number.NaN })])).toBe(false)
    expect(canAdvanceToStep2([line()])).toBe(true)
  })
})

describe('canConfirmTransfer', () => {
  it('requires dest on every line and draft status', () => {
    expect(canConfirmTransfer(draft())).toBe(true)
    expect(canConfirmTransfer(draft({ lines: [line()] }))).toBe(false)
    expect(canConfirmTransfer(draft({ status: 'confirmed' }))).toBe(false)
  })
})
