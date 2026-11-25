import { apiBaseUrl } from './config'
import { clearSession, getToken } from './session'

export class ApiError extends Error {
  status: number
  code?: string
  fields?: unknown

  constructor(status: number, message: string, code?: string, fields?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
  query?: Record<string, string | number | boolean | null | undefined>
}

let redirectingToLogin = false

function redirectToLogin(): void {
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  if (path === '/login' || path.startsWith('/login/')) return
  if (redirectingToLogin) return
  redirectingToLogin = true
  clearSession()
  const next = `${path}${window.location.search}`
  const target =
    next && next !== '/' && !next.startsWith('/login')
      ? `/login?next=${encodeURIComponent(next)}`
      : '/login'
  window.location.assign(target)
}

/** Clear session and send the browser to `/login` (no-op on login itself). */
export function handleUnauthorized(): void {
  clearSession()
  redirectToLogin()
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${apiBaseUrl()}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.auth !== false) {
    const token = getToken()
    if (!token) {
      handleUnauthorized()
      throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.', 'unauthorized')
    }
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.', 'network_error')
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    if (response.status === 401 && options.auth !== false) {
      handleUnauthorized()
    }
    const obj = (data && typeof data === 'object' ? data : {}) as {
      message?: string
      code?: string
      fields?: unknown
    }
    throw new ApiError(
      response.status,
      obj.message ??
        (response.status === 401
          ? 'نشست منقضی شده است. دوباره وارد شوید.'
          : 'خطای سرور'),
      obj.code ?? (response.status === 401 ? 'unauthorized' : undefined),
      obj.fields,
    )
  }

  return data as T
}
