import { describe, expect, it } from 'vitest'
import {
  formatTodayJalaliBanner,
  INVENTORY_STATUS_META,
  remainingDaysText,
  stockCoverageRatio,
  validateStockInForm,
  type StockInFormValues,
} from '@/lib/inventory/helpers'

const BASE_FORM: StockInFormValues = {
  mode: 'existing',
  drugId: 'drug-amox',
  nameFa: '',
  brandName: '',
  dosageForm: 'قرص',
  strength: '',
  category: 'آنتی‌بیوتیک و ضدباکتری',
  genericCode: '',
  gtin: '',
  manufacturer: '',
  isControlled: false,
  storageTemp: 'room',
  reorderLevel: '20',
  batchNo: 'AX-2026',
  expiry: '2027-06-01',
  quantity: '50',
  unitLabel: 'جعبه / بسته',
  binId: 'bin-a030204',
  locationLabel: 'A-03-2-04',
  buyPriceRial: '32000',
  consumerPriceRial: '45000',
}

describe('inventory helpers', () => {
  it('computes bounded coverage ratios', () => {
    expect(stockCoverageRatio(0, 20)).toBe(0)
    expect(stockCoverageRatio(5, 100)).toBe(6)
    expect(stockCoverageRatio(1000, 20)).toBe(100)
  })

  it('formats remaining days in Persian', () => {
    expect(remainingDaysText(-14, 'expired')).toBe('۱۴ روز منقضی شده')
    expect(remainingDaysText(0, 'critical')).toBe('انقضای امروز')
    expect(remainingDaysText(12, 'critical')).toBe('تنها ۱۲ روز باقی‌مانده')
    expect(remainingDaysText(120, 'watch')).toBe('۱۲۰ روز مانده')
  })

  it('formats today Jalali banner and maps triage status', () => {
    expect(formatTodayJalaliBanner('2026-11-12')).toContain('امروز:')
    expect(INVENTORY_STATUS_META.valid.triage).toBe('valid')
    expect(INVENTORY_STATUS_META.expired_quarantine.triage).toBe('critical')
  })

  it('validates existing-drug and new-drug stock-in modes', () => {
    expect(validateStockInForm(BASE_FORM)).toEqual({})

    const existingErrs = validateStockInForm({
      ...BASE_FORM,
      drugId: '',
      batchNo: '',
      quantity: '0',
      binId: '',
      locationLabel: '',
    })
    expect(existingErrs.drugId).toBeTruthy()
    expect(existingErrs.batchNo).toBeTruthy()
    expect(existingErrs.quantity).toBeTruthy()
    expect(existingErrs.binId).toBeTruthy()

    const newModeErrs = validateStockInForm({
      ...BASE_FORM,
      mode: 'new',
      nameFa: '',
      strength: '',
    })
    expect(newModeErrs.nameFa).toBeTruthy()
    expect(newModeErrs.strength).toBeTruthy()
  })
})
