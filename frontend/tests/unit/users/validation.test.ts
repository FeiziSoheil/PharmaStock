import { describe, expect, it } from 'vitest'
import {
  validateResetPassword,
  validateUserForm,
  type UserFormValues,
} from '@/lib/users/validation'

const baseValues: UserFormValues = {
  username: 's.ansari',
  name: 'دکتر سارا انصاری',
  email: 's.ansari@pharmastock.ir',
  phone: '09123456789',
  personnelCode: 'د-۹۹۱۲۳',
  medicalCouncilNo: 'نظام پزشکی دائم',
  role: 'technical_officer',
  branchId: 'branch-central',
  unitLabel: 'داروخانه مرکزی',
  password: 'Password123',
}

describe('users validation', () => {
  it('accepts valid create input', () => {
    expect(validateUserForm(baseValues, 'create')).toEqual({})
  })

  it('rejects missing required fields and short password on create', () => {
    const errors = validateUserForm(
      {
        ...baseValues,
        username: 'ا',
        name: '   ',
        personnelCode: '',
        password: '123',
        email: 'bad-email',
      },
      'create',
    )
    expect(errors.username).toBeTruthy()
    expect(errors.name).toBeTruthy()
    expect(errors.personnelCode).toBeTruthy()
    expect(errors.password).toBeTruthy()
    expect(errors.email).toBeTruthy()
  })

  it('skips username/password checks in edit mode', () => {
    const errors = validateUserForm(
      { ...baseValues, username: '', password: '' },
      'edit',
    )
    expect(errors).toEqual({})
  })

  it('validates password reset matching and length', () => {
    expect(validateResetPassword('1234', '1234').password).toBeTruthy()
    expect(
      validateResetPassword('Password123', 'Password456').confirmPassword,
    ).toBeTruthy()
    expect(validateResetPassword('Password123', 'Password123')).toEqual({})
  })
})
