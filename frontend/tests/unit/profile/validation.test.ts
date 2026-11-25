import { describe, expect, it } from 'vitest'
import {
  validateChangePasswordForm,
  validateProfileForm,
  type ChangePasswordFormValues,
  type ProfileFormValues,
} from '@/lib/profile/validation'

describe('validateProfileForm', () => {
  it('rejects empty or whitespace-only name', () => {
    const values: ProfileFormValues = {
      name: '   ',
      email: '',
      phone: '',
    }
    const errors = validateProfileForm(values)
    expect(errors.name).toBe('نام و نام خانوادگی الزامی است')
  })

  it('rejects invalid email formats', () => {
    const values: ProfileFormValues = {
      name: 'دکتر رضایی',
      email: 'not-an-email',
      phone: '',
    }
    const errors = validateProfileForm(values)
    expect(errors.email).toBe('فرمت ایمیل واردشده معتبر نیست')
  })

  it('rejects short phone number', () => {
    const values: ProfileFormValues = {
      name: 'دکتر رضایی',
      email: 'rezaei@test.ir',
      phone: '12345',
    }
    const errors = validateProfileForm(values)
    expect(errors.phone).toBe('شماره تماس باید حداقل ۸ رقم باشد')
  })

  it('accepts valid profile values with empty optional email and phone', () => {
    const values: ProfileFormValues = {
      name: 'دکتر محمدرضا رضایی',
      email: '',
      phone: '',
    }
    const errors = validateProfileForm(values)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('accepts fully populated valid profile values', () => {
    const values: ProfileFormValues = {
      name: 'دکتر محمدرضا رضایی',
      email: 'dr.rezaei@pharmastock.ir',
      phone: '09121111111',
    }
    const errors = validateProfileForm(values)
    expect(Object.keys(errors)).toHaveLength(0)
  })
})

describe('validateChangePasswordForm', () => {
  it('requires current password', () => {
    const values: ChangePasswordFormValues = {
      currentPassword: '',
      newPassword: 'BrandNewPassword1',
      confirmPassword: 'BrandNewPassword1',
    }
    const errors = validateChangePasswordForm(values)
    expect(errors.currentPassword).toBe('رمز عبور فعلی الزامی است')
  })

  it('requires new password to be at least 8 characters', () => {
    const values: ChangePasswordFormValues = {
      currentPassword: 'OldPassword123',
      newPassword: 'short',
      confirmPassword: 'short',
    }
    const errors = validateChangePasswordForm(values)
    expect(errors.newPassword).toBe('رمز عبور جدید باید حداقل ۸ کاراکتر باشد')
  })

  it('rejects new password identical to current password', () => {
    const values: ChangePasswordFormValues = {
      currentPassword: 'Password123',
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    }
    const errors = validateChangePasswordForm(values)
    expect(errors.newPassword).toBe('رمز عبور جدید نمی‌تواند مشابه رمز فعلی باشد')
  })

  it('rejects mismatched confirm password', () => {
    const values: ChangePasswordFormValues = {
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword123',
      confirmPassword: 'DifferentPassword123',
    }
    const errors = validateChangePasswordForm(values)
    expect(errors.confirmPassword).toBe('تکرار رمز عبور با رمز جدید مطابقت ندارد')
  })

  it('accepts valid password change payload', () => {
    const values: ChangePasswordFormValues = {
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword2026',
      confirmPassword: 'NewPassword2026',
    }
    const errors = validateChangePasswordForm(values)
    expect(Object.keys(errors)).toHaveLength(0)
  })
})
