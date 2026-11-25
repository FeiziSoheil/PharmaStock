import { apiLogin } from '@/lib/api/auth'
import { saveSession } from '@/lib/api/session'
import { toPersianDigits } from '@/lib/persian'

export type AuthInput = {
  branchId: string
  username: string
  password: string
}

export type AuthFailure = {
  ok: false
  code:
    | 'account_locked'
    | 'network_error'
    | 'temporary_lock'
    | 'invalid_credentials'
  message: string
  canRetry?: boolean
  retryAfterSeconds?: number
}

export type AuthResult = { ok: true } | AuthFailure

function mapApiFailure(
  code: string,
  message: string,
  retryAfterSeconds?: number,
): AuthFailure {
  if (code === 'account_locked') {
    return { ok: false, code: 'account_locked', message }
  }
  if (code === 'temporary_lock') {
    const sec = retryAfterSeconds ?? 60
    return {
      ok: false,
      code: 'temporary_lock',
      retryAfterSeconds: sec,
      message:
        message ||
        `ورود موقتاً قفل شده است. ${toPersianDigits(sec)} ثانیه دیگر دوباره تلاش کنید.`,
    }
  }
  if (code === 'invalid_credentials') {
    return {
      ok: false,
      code: 'invalid_credentials',
      message: message || 'نام کاربری یا رمز عبور نادرست است.',
    }
  }
  return {
    ok: false,
    code: 'network_error',
    canRetry: true,
    message:
      message || 'خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.',
  }
}

export async function authenticate(
  input: AuthInput,
  options?: { rememberSession?: boolean },
): Promise<AuthResult> {
  const result = await apiLogin(input)
  if (result.ok) {
    saveSession(
      result.token,
      {
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
        role: result.user.role,
      },
      options?.rememberSession ?? true,
    )
    return { ok: true }
  }

  return mapApiFailure(result.code, result.message, result.retryAfterSeconds)
}
