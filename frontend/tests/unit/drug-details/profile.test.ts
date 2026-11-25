import { describe, expect, it } from 'vitest'
import { profileFromDrug } from '@/lib/drug-details/profile'
import type { Drug } from '@/lib/types/drugs'

describe('profileFromDrug', () => {
  it('maps catalog fields into detail profile', () => {
    const drug: Drug = {
      id: 'drug-amox',
      nameFa: 'آموکسی‌سیلین',
      brandName: 'Amoxil',
      dosageForm: 'کپسول',
      strength: '500mg',
      gtin: '6260001000001',
      genericCode: '12345',
      manufacturer: 'فارابی',
      category: 'آنتی‌بیوتیک و ضدباکتری',
      isControlled: false,
      totalStock: 25,
      reorderLevel: 40,
      nearestExpiry: '2026-12-01',
      storageTemp: 'room',
    }
    const profile = profileFromDrug(drug)
    expect(profile.drugId).toBe('drug-amox')
    expect(profile.nameFa).toContain('آموکسی')
    expect(profile.irc).toBe('12345')
    expect(profile.legalClassLabel).toBe('عادی')
    expect(profile.storageLabel).toContain('اتاق')
  })
})
