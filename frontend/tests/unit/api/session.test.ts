import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  getSessionUser,
  getToken,
  saveSession,
  subscribeSession,
  updateSessionUser,
  type SessionUser,
} from '@/lib/api/session'

describe('session storage & reactivity', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  afterEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('saves session and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSession(listener)

    const user: SessionUser = {
      id: 'u-1',
      username: 'dr.rezaei',
      name: 'دکتر محمدرضا رضایی',
      role: 'technical_officer',
    }

    saveSession('token-123', user, false)

    expect(getToken()).toBe('token-123')
    expect(getSessionUser()).toEqual(user)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it('updates session user and keeps storage mode', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSession(listener)

    const user: SessionUser = {
      id: 'u-1',
      username: 'dr.rezaei',
      name: 'دکتر محمدرضا رضایی',
      role: 'technical_officer',
    }

    saveSession('token-abc', user, true) // localStorage
    expect(window.localStorage.getItem('pharmastock.user')).toBeTruthy()

    const updated = updateSessionUser({ name: 'دکتر رضایی ویرایش‌شده' })
    expect(updated?.name).toBe('دکتر رضایی ویرایش‌شده')
    expect(getSessionUser()?.name).toBe('دکتر رضایی ویرایش‌شده')
    expect(window.localStorage.getItem('pharmastock.user')).toContain('دکتر رضایی ویرایش‌شده')
    expect(listener).toHaveBeenCalled()

    unsubscribe()
  })

  it('clears session and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSession(listener)

    saveSession('token-xyz', { id: 'u-2', username: 'op', name: 'اپراتور', role: 'operator' }, false)
    clearSession()

    expect(getToken()).toBeNull()
    expect(getSessionUser()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
  })
})
