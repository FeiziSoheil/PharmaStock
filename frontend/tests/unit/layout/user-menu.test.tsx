import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserMenu } from '@/components/layout/user-menu'
import { clearSession, saveSession, type SessionUser } from '@/lib/api/session'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('UserMenu', () => {
  beforeEach(() => {
    mockPush.mockReset()
    clearSession()
  })

  afterEach(() => {
    clearSession()
  })

  it('renders fallback initial when no user is logged in', () => {
    render(<UserMenu />)
    const trigger = screen.getByRole('button', { name: 'کاربر جاری' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('؟')
  })

  it('renders user first initial and opens menu with profile and logout', async () => {
    const user = userEvent.setup()
    const sessionUser: SessionUser = {
      id: 'u-1',
      username: 'dr.rezaei',
      name: 'دکتر محمدرضا رضایی',
      role: 'technical_officer',
    }
    saveSession('tok-1', sessionUser, false)

    render(<UserMenu />)
    const trigger = screen.getByRole('button', { name: 'دکتر محمدرضا رضایی' })
    expect(trigger).toHaveTextContent('د')

    await user.click(trigger)

    expect(screen.getByText('دکتر محمدرضا رضایی')).toBeInTheDocument()
    expect(screen.getByText('مسئول فنی')).toBeInTheDocument()

    const profileLink = screen.getByRole('link', { name: 'پروفایل من' })
    expect(profileLink).toHaveAttribute('href', '/profile')

    const logoutBtn = screen.getByRole('button', { name: 'خروج از حساب' })
    await user.click(logoutBtn)

    expect(mockPush).toHaveBeenCalledWith('/login')
  })
})
