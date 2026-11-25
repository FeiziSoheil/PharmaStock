import { normalizePersianText } from '@/lib/persian'

export type LoginFormValues = {
  branchId: string
  username: string
  password: string
  captcha: string
}

export type LoginFieldErrors = Partial<Record<keyof LoginFormValues, string>>

/** Normalize captcha challenge/input to Latin digits for comparison. */
export function normalizeCaptchaInput(input: string): string {
  return normalizePersianText(input).replace(/\s+/g, '')
}

export function validateLoginForm(
  values: LoginFormValues,
  captchaChallenge: string,
): LoginFieldErrors {
  const errors: LoginFieldErrors = {}

  if (!values.branchId.trim()) {
    errors.branchId = 'انتخاب شعبه الزامی است'
  }
  if (!values.username.trim()) {
    errors.username = 'شناسه پرسنلی الزامی است'
  }
  if (!values.password) {
    errors.password = 'کلمه عبور الزامی است'
  }

  const captcha = values.captcha.trim()
  if (!captcha) {
    errors.captcha = 'کد اعتبارسنجی الزامی است'
  } else if (
    normalizeCaptchaInput(captcha) !== normalizeCaptchaInput(captchaChallenge)
  ) {
    errors.captcha = 'کد اعتبارسنجی نادرست است'
  }

  return errors
}

export function firstInvalidField(
  errors: LoginFieldErrors,
): keyof LoginFormValues | null {
  const order: (keyof LoginFormValues)[] = [
    'branchId',
    'username',
    'password',
    'captcha',
  ]
  return order.find((key) => Boolean(errors[key])) ?? null
}
