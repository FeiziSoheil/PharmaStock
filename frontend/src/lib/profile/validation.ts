export type ProfileFormValues = {
  name: string
  email: string
  phone: string
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>

export type ChangePasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export type ChangePasswordFormErrors = Partial<
  Record<keyof ChangePasswordFormValues, string>
>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateProfileForm(
  values: ProfileFormValues,
): ProfileFormErrors {
  const errors: ProfileFormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'نام و نام خانوادگی الزامی است'
  }
  if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) {
    errors.email = 'فرمت ایمیل واردشده معتبر نیست'
  }
  if (values.phone.trim() && values.phone.trim().length < 8) {
    errors.phone = 'شماره تماس باید حداقل ۸ رقم باشد'
  }

  return errors
}

export function validateChangePasswordForm(
  values: ChangePasswordFormValues,
): ChangePasswordFormErrors {
  const errors: ChangePasswordFormErrors = {}

  if (!values.currentPassword) {
    errors.currentPassword = 'رمز عبور فعلی الزامی است'
  }
  if (!values.newPassword) {
    errors.newPassword = 'رمز عبور جدید الزامی است'
  } else if (values.newPassword.length < 8) {
    errors.newPassword = 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد'
  } else if (
    values.currentPassword &&
    values.newPassword === values.currentPassword
  ) {
    errors.newPassword = 'رمز عبور جدید نمی‌تواند مشابه رمز فعلی باشد'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'تکرار رمز عبور جدید الزامی است'
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'تکرار رمز عبور با رمز جدید مطابقت ندارد'
  }

  return errors
}
