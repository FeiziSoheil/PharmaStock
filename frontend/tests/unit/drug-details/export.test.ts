import { describe, expect, it } from 'vitest'
import {
  buildBarcodeLabelHtml,
  buildBatchesCsv,
  buildCardexPrintHtml,
} from '@/lib/drug-details/export'
import type { DrugBatchRow } from '@/lib/drug-details/types'
import type { CardexMovement } from '@/lib/types/cardex'

const sampleBatch: DrugBatchRow = {
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
}

const sampleMovement: CardexMovement & { balance: number } = {
  id: 'm1',
  drugId: 'd-001',
  timestampISO: '2026-11-10T08:00:00.000Z',
  type: 'inbound',
  batchNo: 'M9041',
  qtyIn: 100,
  qtyOut: 0,
  actorName: 'اپراتور تست',
  shiftLabel: 'صبح',
  note: 'ورود اولیه',
  balance: 100,
}

describe('buildBatchesCsv', () => {
  it('prefixes UTF-8 BOM and includes Persian batch header with ISO columns', () => {
    const csv = buildBatchesCsv([sampleBatch])

    expect(csv.charCodeAt(0)).toBe(0xfeff)

    const header = csv.slice(1).split('\n')[0]!
    expect(header).toContain('شماره سری ساخت')
    expect(header).toMatch(/ISO/)
    expect(csv).toContain('M9041')
    expect(csv).toContain('2022-11-06')
    expect(csv).toContain('2025-05-05')
  })
})

describe('buildCardexPrintHtml', () => {
  it('renders RTL printable cardex with drug name and balance', () => {
    const html = buildCardexPrintHtml({ nameFa: 'متفورمین' }, [sampleMovement])

    expect(html).toContain('lang="fa"')
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('متفورمین')
    expect(html).toContain('M9041')
    expect(html).toContain('مانده')
  })
})

describe('buildBarcodeLabelHtml', () => {
  it('renders printable shelf label with name and location hint', () => {
    const html = buildBarcodeLabelHtml(
      { nameFa: 'متفورمین', gtin: '6260000000001', brandName: 'گلوکوفاژ' },
      'قفسه A-12',
    )

    expect(html).toContain('lang="fa"')
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('متفورمین')
    expect(html).toContain('قفسه A-12')
    expect(html).toContain('6260000000001')
  })
})
