import { describe, expect, it } from 'vitest'
import {
  validateControlledForm,
  type ControlledFormState,
} from '@/lib/controlled/validation'

function baseForm(
  overrides: Partial<ControlledFormState> = {},
): ControlledFormState {
  return {
    drugId: 'drug-morphine',
    txType: 'out_prescription',
    wasteMode: 'used_ampoule',
    quantity: '2',
    batchId: 'batch-mor-1',
    batchNo: 'MR-09',
    expiry: '2027-03-01',
    binId: 'bin-s010101',
    physicianName: 'دکتر صابری',
    physicianLicense: 'م-۴۸۹۲۱',
    patientNationalId: '۰۰۷۱۲۳۴۵۸۳',
    patientNote: '',
    trackingCode: 'TTAC-884920',
    sepasCode: '1804928',
    technicalAck: true,
    ...overrides,
  }
}

describe('validateControlledForm', () => {
  it('accepts valid out_prescription with Persian digits in nationalId', () => {
    const errors = validateControlledForm(baseForm(), 12)
    expect(errors).toEqual({})
  })

  it('rejects quantity exceeding active batch stock', () => {
    const errors = validateControlledForm(baseForm({ quantity: '15' }), 12)
    expect(errors.quantity).toBeDefined()
  })

  it('rejects missing technicalAck and invalid national ID', () => {
    const errors = validateControlledForm(
      baseForm({ technicalAck: false, patientNationalId: '12345' }),
      12,
    )
    expect(errors.technicalAck).toBeDefined()
    expect(errors.patientNationalId).toBeDefined()
  })

  it('requires expiry and distributor for in_distributor', () => {
    const errors = validateControlledForm(
      baseForm({
        txType: 'in_distributor',
        physicianName: '',
        expiry: 'bad-date',
        patientNationalId: '',
      }),
    )
    expect(errors.physicianName).toBeDefined()
    expect(errors.expiry).toBeDefined()
    expect(errors.patientNationalId).toBeUndefined()
  })

  it('allows used_ampoule waste_return without deducting active stock', () => {
    const errors = validateControlledForm(
      baseForm({
        txType: 'waste_return',
        wasteMode: 'used_ampoule',
        quantity: '25',
        patientNationalId: '',
      }),
      5,
    )
    expect(errors).toEqual({})
  })
})
