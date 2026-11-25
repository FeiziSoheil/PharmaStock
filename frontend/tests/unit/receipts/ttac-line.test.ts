import { describe, expect, it } from 'vitest'
import { ttacProductToLinePatch } from '@/lib/receipts/ttac-line'
import type { TtacProduct } from '@/lib/types/drugs'

const sample: TtacProduct = {
  nameFa: 'آزارام قرص',
  brandName: 'AZARAM',
  dosageForm: 'قرص',
  strength: '50 mg',
  gtin: '06260166801277',
  genericCode: '122',
  manufacturer: 'رامو فارمین',
  atcCode: '',
  licenseExpiry: '',
  category: 'مسکن و ضدالتهاب',
  irc: '5281752637952018',
}

describe('ttacProductToLinePatch', () => {
  it('maps gtin irc and name', () => {
    expect(ttacProductToLinePatch(sample)).toEqual({
      gtin: '06260166801277',
      irc: '5281752637952018',
      nameFa: 'آزارام قرص',
    })
  })
})
