import { describe, expect, it } from 'vitest'
import { canConfirmDispense, computeDispenseTotals } from '@/lib/dispenses/gating'
import type { DispenseLine, DispenseOrder } from '@/lib/types/dispenses'

const line = (over: Partial<DispenseLine> = {}): DispenseLine => ({
  id: 'l1',
  drugId: 'drug-amox',
  nameFa: 'آموکسی‌سیلین',
  unitLabel: 'عدد',
  quantity: 2,
  consumerPrice: 45000,
  batchId: 'batch-amox-1',
  batchNo: 'AX-2401',
  expiry: '2026-12-01',
  locationLabel: 'A-03-2-04',
  allocation: 'fefo',
  isColdChain: false,
  isControlled: false,
  ...over,
})

const order = (over: Partial<DispenseOrder> = {}): DispenseOrder => ({
  id: 'd1',
  status: 'draft',
  patient: { nameFa: 'بیمار نمونه' },
  lines: [line()],
  fees: { technicalFee: 50000, insuranceCover: 0 },
  createdBy: { userId: 'u1', name: 'اپراتور', role: 'operator' },
  createdAt: '2026-11-12T00:00:00Z',
  updatedAt: '2026-11-12T00:00:00Z',
  ...over,
})

describe('computeDispenseTotals', () => {
  it('sums goods and patient payable', () => {
    expect(
      computeDispenseTotals(
        order({
          lines: [
            line({ quantity: 2, consumerPrice: 45000 }),
            line({ id: 'l2', quantity: 1, consumerPrice: 890000, isColdChain: true }),
          ],
          fees: { technicalFee: 50000, insuranceCover: 10000 },
        }),
      ),
    ).toEqual({
      goodsTotal: 980000,
      technicalFee: 50000,
      insuranceCover: 10000,
      patientPayable: 1020000,
      lineCount: 2,
      coldCount: 1,
      controlledCount: 0,
    })
  })
})

describe('canConfirmDispense', () => {
  it('rejects empty patient name', () => {
    expect(canConfirmDispense(order({ patient: { nameFa: '  ' } }))).toBe(false)
  })
  it('rejects empty lines', () => {
    expect(canConfirmDispense(order({ lines: [] }))).toBe(false)
  })
  it('rejects incomplete controlled', () => {
    expect(
      canConfirmDispense(
        order({
          lines: [
            line({
              isControlled: true,
              controlled: {
                physicianName: 'دکتر',
                recipientNationalId: '007',
                eRxTrackingId: 'RX-1',
                technicalAck: false,
              },
            }),
          ],
        }),
      ),
    ).toBe(false)
  })
  it('rejects manual without reason', () => {
    expect(
      canConfirmDispense(order({ lines: [line({ allocation: 'manual', manualReason: '' })] })),
    ).toBe(false)
  })
  it('allows complete draft', () => {
    expect(canConfirmDispense(order())).toBe(true)
  })
})
