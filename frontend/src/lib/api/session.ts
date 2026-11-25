const TOKEN_KEY = 'pharmastock.token'
const USER_KEY = 'pharmastock.user'
const SESSION_EVENT = 'pharmastock:session-change'

export type SessionUser = {
  id: string
  username: string
  name: string
  role: string
}

function storage(remember: boolean): Storage | null {
  if (typeof window === 'undefined') return null
  return remember ? window.localStorage : window.sessionStorage
}

function emitSessionChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_EVENT))
}

export function subscribeSession(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => cb()
  window.addEventListener(SESSION_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(SESSION_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

function rawClearSession(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(TOKEN_KEY)
  window.sessionStorage.removeItem(USER_KEY)
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function saveSession(
  token: string,
  user: SessionUser,
  remember: boolean,
): void {
  rawClearSession()
  const store = storage(remember)
  if (!store) return
  store.setItem(TOKEN_KEY, token)
  store.setItem(USER_KEY, JSON.stringify(user))
  emitSessionChange()
}

export function updateSessionUser(
  patch: Partial<SessionUser>,
): SessionUser | null {
  if (typeof window === 'undefined') return null

  const isLocal = Boolean(window.localStorage.getItem(USER_KEY))
  const isSession = Boolean(window.sessionStorage.getItem(USER_KEY))
  if (!isLocal && !isSession) return null

  const store = isLocal ? window.localStorage : window.sessionStorage
  const raw = store.getItem(USER_KEY)
  if (!raw) return null

  try {
    const current = JSON.parse(raw) as SessionUser
    const updated: SessionUser = { ...current, ...patch }
    store.setItem(USER_KEY, JSON.stringify(updated))
    emitSessionChange()
    return updated
  } catch {
    return null
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return (
    window.sessionStorage.getItem(TOKEN_KEY) ??
    window.localStorage.getItem(TOKEN_KEY)
  )
}

let cachedRawUser: string | null | undefined
let cachedParsedUser: SessionUser | null = null

function getCachedSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null
  const raw =
    window.sessionStorage.getItem(USER_KEY) ??
    window.localStorage.getItem(USER_KEY)

  if (raw === cachedRawUser) {
    return cachedParsedUser
  }

  cachedRawUser = raw
  if (!raw) {
    cachedParsedUser = null
    return null
  }

  try {
    cachedParsedUser = JSON.parse(raw) as SessionUser
    return cachedParsedUser
  } catch {
    cachedParsedUser = null
    return null
  }
}

export function getSessionUser(): SessionUser | null {
  return getCachedSessionUser()
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(TOKEN_KEY)
  window.sessionStorage.removeItem(USER_KEY)
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
  emitSessionChange()
}
