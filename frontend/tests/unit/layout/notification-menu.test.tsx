import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { NotificationMenu } from '@/components/layout/notification-menu'
import {
  getUnreadCount,
  markAllNotificationsAsRead,
  resetNotifications,
} from '@/lib/notifications'

describe('NotificationMenu', () => {
  beforeEach(() => {
    resetNotifications()
  })

  it('renders notification trigger button with aria-label', () => {
    render(<NotificationMenu />)
    const button = screen.getByRole('button', { name: 'اعلان‌ها' })
    expect(button).toBeInTheDocument()
  })

  it('displays badge with unread count initially', () => {
    render(<NotificationMenu />)
    const unread = getUnreadCount()
    expect(unread).toBeGreaterThan(0)
    const badge = document.querySelector('[data-slot="notification-badge"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('۳')
  })

  it('opens popover when clicked and shows notification items with Persian heading', async () => {
    const user = userEvent.setup()
    render(<NotificationMenu />)

    const trigger = screen.getByRole('button', { name: 'اعلان‌ها' })
    await user.click(trigger)

    expect(screen.getByText('اعلان‌ها و هشدارها')).toBeInTheDocument()
    expect(screen.getByText('انقضای بحرانی داروی آموکسی‌سیلین ۵۰۰')).toBeInTheDocument()
    expect(screen.getByText('کسری موجودی قرص سیتریزین ۱۰ م‌گ')).toBeInTheDocument()
  })

  it('filters notifications by category tab', async () => {
    const user = userEvent.setup()
    render(<NotificationMenu />)

    await user.click(screen.getByRole('button', { name: 'اعلان‌ها' }))

    // Click Reorder category tab
    const reorderTab = screen.getByRole('button', { name: 'کسری موجودی' })
    await user.click(reorderTab)

    expect(screen.getByText('کسری موجودی قرص سیتریزین ۱۰ م‌گ')).toBeInTheDocument()
    expect(screen.queryByText('انقضای بحرانی داروی آموکسی‌سیلین ۵۰۰')).not.toBeInTheDocument()

    // Click Expiry category tab
    const expiryTab = screen.getByRole('button', { name: 'انقضا و FEFO' })
    await user.click(expiryTab)

    expect(screen.getByText('انقضای بحرانی داروی آموکسی‌سیلین ۵۰۰')).toBeInTheDocument()
    expect(screen.queryByText('کسری موجودی قرص سیتریزین ۱۰ م‌گ')).not.toBeInTheDocument()
  })

  it('marks all as read when clicking "خوانده شد"', async () => {
    const user = userEvent.setup()
    render(<NotificationMenu />)

    await user.click(screen.getByRole('button', { name: 'اعلان‌ها' }))

    const markAllButton = screen.getByRole('button', { name: /خوانده شد/i })
    await user.click(markAllButton)

    expect(getUnreadCount()).toBe(0)
    expect(screen.queryByRole('button', { name: /خوانده شد/i })).not.toBeInTheDocument()
  })

  it('removes notification when clicking delete/dismiss', async () => {
    const user = userEvent.setup()
    render(<NotificationMenu />)

    await user.click(screen.getByRole('button', { name: 'اعلان‌ها' }))

    const dismissButtons = screen.getAllByRole('button', { name: 'حذف اعلان' })
    expect(dismissButtons.length).toBeGreaterThan(0)

    await user.click(dismissButtons[0]!)
    expect(screen.queryByText('انقضای بحرانی داروی آموکسی‌سیلین ۵۰۰')).not.toBeInTheDocument()
  })

  it('shows empty state when all notifications in category or all are removed', async () => {
    const user = userEvent.setup()
    render(<NotificationMenu />)

    markAllNotificationsAsRead()

    await user.click(screen.getByRole('button', { name: 'اعلان‌ها' }))

    // Remove all
    const buttons = screen.getAllByRole('button', { name: 'حذف اعلان' })
    for (const btn of buttons) {
      await user.click(btn)
    }

    expect(screen.getByText('هیچ اعلان جدیدی وجود ندارد')).toBeInTheDocument()
  })
})
