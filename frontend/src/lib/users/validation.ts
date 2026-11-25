export type UserFormValues = {
  username: string
  name: string
  email: string
  phone: string
  personnelCode: string
  medicalCouncilNo: string
  role: string
  branchId: string
  unitLabel: string
  password: string
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateUserForm(
  values: UserFormValues,
  mode: 'create' | 'edit',
): UserFormErrors {
  const errors: UserFormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'نام و نام خانوادگی الزامی است'
  }
  if (!values.personnelCode.trim()) {
    errors.personnelCode = 'کد پرسنلی یا شماره نظام پزشکی الزامی است'
  }
  if (!values.role.trim()) {
    errors.role = 'انتخاب نقش سازمانی الزامی است'
  }
  if (!values.branchId.trim()) {
    errors.branchId = 'انتخاب شعبه یا واحد استقرار الزامی است'
  }
  if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) {
    errors.email = 'فرمت ایمیل واردشده معتبر نیست'
  }
  if (values.phone.trim() && values.phone.trim().length < 8) {
    errors.phone = 'شماره تماس باید حداقل ۸ رقم باشد'
  }
  if (mode === 'create') {
    if (!USERNAME_RE.test(values.username.trim())) {
      errors.username =
        'نام کاربری باید ۳ تا ۴۰ کاراکتر انگلیسی، عدد، نقطه یا خط تیره باشد'
    }
    if (values.password.length < 8) {
      errors.password = 'رمز عبور اولیه باید حداقل ۸ کاراکتر باشد'
    }
  }

  return errors
}

export function validateResetPassword(
  password: string,
  confirmPassword: string,
): { password?: string; confirmPassword?: string } {
  const errors: { password?: string; confirmPassword?: string } = {}
  if (password.length < 8) {
    errors.password = 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد'
  }
  if (confirmPassword !== password) {
    errors.confirmPassword = 'تکرار رمز عبور با رمز جدید مطابقت ندارد'
  }
  return errors
}
