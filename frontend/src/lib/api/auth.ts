import { apiBaseUrl } from './config'

/** Map UI branch select ids → backend seed branch ids. */
export const BRANCH_ID_MAP: Record<string, string> = {
  central: 'branch-central',
  cold_chain: 'branch-cold',
  valiasr: 'branch-valiasr',
  emergency: 'branch-er',
}

export type ApiLoginSuccess = {
  ok: true
  token: string
  user: {
    id: string
    username: string
    name: string
    role: string
  }
  branch: {
    id: string
    nameFa: string
  }
}

export type ApiLoginFailure = {
  ok: false
  code: string
  message: string
  canRetry?: boolean
  retryAfterSeconds?: number
}

export type ApiLoginResult = ApiLoginSuccess | ApiLoginFailure

export async function apiLogin(input: {
  username: string
  password: string
  branchId: string
}): Promise<ApiLoginResult> {
  const branchId = BRANCH_ID_MAP[input.branchId] ?? input.branchId
  try {
    const response = await fetch(`${apiBaseUrl()}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: input.username,
        password: input.password,
        branchId,
      }),
    })
    const data = (await response.json()) as ApiLoginResult
    if (data && typeof data === 'object' && 'ok' in data) {
      return data
    }
    return {
      ok: false,
      code: 'network_error',
      message: 'پاسخ نامعتبر از سرور دریافت شد.',
      canRetry: true,
    }
  } catch {
    return {
      ok: false,
      code: 'network_error',
      message: 'خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.',
      canRetry: true,
    }
  }
}
