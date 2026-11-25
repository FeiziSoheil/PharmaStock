import { describe, expect, it } from 'vitest'
import {
  normalizeCaptchaInput,
  validateLoginForm,
  type LoginFormValues,
} from '@/lib/auth/login-validation'

const base: LoginFormValues = {
  branchId: 'central',
  username: '98451',
  password: 'secret',
  captcha: '۵۸۲۴',
}

describe('normalizeCaptchaInput', () => {
  it('equates Persian, Arabic, and Latin digits', () => {
    expect(normalizeCaptchaInput('۵۸۲۴')).toBe('5824')
    expect(normalizeCaptchaInput('٥٨٢٤')).toBe('5824')
    expect(normalizeCaptchaInput('5824')).toBe('5824')
  })
})

describe('validateLoginForm', () => {
  it('returns no errors for a complete valid form', () => {
    expect(validateLoginForm(base, '5824')).toEqual({})
  })

  it('requires branch, username, password, and captcha with Persian messages', () => {
    const errors = validateLoginForm(
      { branchId: '', username: '  ', password: '', captcha: '' },
      '5824',
    )
    expect(errors.branchId).toBe('انتخاب شعبه الزامی است')
    expect(errors.username).toBe('شناسه پرسنلی الزامی است')
    expect(errors.password).toBe('کلمه عبور الزامی است')
    expect(errors.captcha).toBe('کد اعتبارسنجی الزامی است')
  })

  it('rejects mismatched captcha after digit normalization', () => {
    const errors = validateLoginForm({ ...base, captcha: '۱۲۳۴' }, '۵۸۲۴')
    expect(errors.captcha).toBe('کد اعتبارسنجی نادرست است')
  })

  it('accepts captcha when scripts differ but digits match', () => {
    expect(validateLoginForm({ ...base, captcha: '5824' }, '۵۸۲۴')).toEqual({})
  })
})
