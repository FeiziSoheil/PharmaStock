import { describe, expect, it } from 'vitest'
import { buildControlledPdfHtml } from '@/lib/controlled/export'
import type { ControlledLedgerEntry } from '@/lib/types/controlled'

describe('buildControlledPdfHtml', () => {
  it('renders RTL inspection report with Persian digits and escaped content', () => {
    const entries: ControlledLedgerEntry[] = [
      {
        id: 'e1',
        seqNo: 1,
        timestamp: '2026-11-10T10:00:00Z',
        drugId: 'drug-morphine',
        drugNameFa: 'مورفین سولفات',
        dosageStrength: 'آمپول 10mg/ml',
        unitLabel: 'آمپول',
        batchNo: 'MR-09',
        txType: 'out_prescription',
        txSubLabel: 'خروج با نسخه الکترونیک',
        qtyIn: 0,
        qtyOut: 4,
        ampouleWasteCount: 0,
        balanceAfter: 12,
        physicianName: 'دکتر صابری',
        patientNationalIdMasked: '007****583',
        trackingCode: 'TTAC-884920',
        technicalAck: true,
        signedBy: {
          userId: 'u1',
          name: 'دکتر رضایی',
          role: 'technical_officer',
        },
        source: 'ledger',
      },
    ]

    const html = buildControlledPdfHtml(entries, {
      totalVaultBalance: 12,
      controlledDrugCount: 1,
      monthInflow: 16,
      monthInflowShipments: 1,
      monthOutflow: 4,
      activePrescriptionCount: 1,
      wasteDestroyedCount: 0,
      totalEntries: 1,
      reconciliationPct: 100,
    })

    expect(html).toContain('dir="rtl"')
    expect(html).toContain('مورفین سولفات')
    expect(html).toContain('TTAC-884920')
    expect(html).toContain('دکتر رضایی')
  })
})
