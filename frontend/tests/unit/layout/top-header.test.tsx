import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TopHeader } from '@/components/layout/top-header'
import { formatPersianTime } from '@/lib/persian'

describe('TopHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-03-20T12:34:56'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders branch and search; exposes menu when requested', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onMenuClick = vi.fn()
    render(
      <TopHeader
        branchLabel="شعبه مرکزی"
        showMenuButton
        onMenuClick={onMenuClick}
      />,
    )
    expect(screen.getByText('شعبه مرکزی')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'جستجوی سراسری' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'باز کردن منو' }))
    expect(onMenuClick).toHaveBeenCalledTimes(1)
  })

  it('shows a live clock with seconds that ticks each second', () => {
    render(<TopHeader />)
    const clock = screen.getByLabelText('ساعت جاری')
    expect(clock).toHaveTextContent(formatPersianTime('2026-03-20T12:34:56'))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(clock).toHaveTextContent(formatPersianTime('2026-03-20T12:34:57'))
  })

  it('renders unified UserMenu trigger in actions bar', () => {
    render(<TopHeader />)
    expect(screen.getByRole('button', { name: 'کاربر جاری' })).toBeInTheDocument()
  })

  it('renders notification trigger in actions bar', () => {
    render(<TopHeader />)
    expect(screen.getByRole('button', { name: 'اعلان‌ها' })).toBeInTheDocument()
  })

  it('opens a quick-add menu with navigation links when clicking the plus button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TopHeader />)

    const quickAddButton = screen.getByRole('button', { name: 'افزودن سریع' })
    expect(screen.queryByText('دسترسی فوری به ثبت عملیات جدید')).not.toBeInTheDocument()

    await user.click(quickAddButton)

    expect(screen.getByText('دسترسی فوری به ثبت عملیات جدید')).toBeInTheDocument()
    const newDrugLink = screen.getByRole('link', { name: /ثبت داروی جدید/ })
    expect(newDrugLink).toHaveAttribute('href', '/drug-catalog')
    expect(screen.getByRole('link', { name: /ورود فاکتور و رسید انبار/ })).toHaveAttribute(
      'href',
      '/invoice-receipts',
    )
    expect(screen.getByRole('link', { name: /حواله خروج و فروش/ })).toHaveAttribute(
      'href',
      '/dispensing-dispatch',
    )
    expect(screen.getByRole('link', { name: /انتقال داخلی/ })).toHaveAttribute(
      'href',
      '/internal-transfer',
    )

    newDrugLink.addEventListener('click', (event) => event.preventDefault())
    await user.click(newDrugLink)
    expect(screen.queryByText('دسترسی فوری به ثبت عملیات جدید')).not.toBeInTheDocument()
  })

  it('calls custom onQuickAdd handler when provided', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onQuickAdd = vi.fn()
    render(<TopHeader onQuickAdd={onQuickAdd} />)

    await user.click(screen.getByRole('button', { name: 'افزودن سریع' }))
    expect(onQuickAdd).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('دسترسی فوری به ثبت عملیات جدید')).not.toBeInTheDocument()
  })

  it('aligns height of all navbar elements uniformly to 40px (h-10 / size-10)', () => {
    const { container } = render(<TopHeader showMenuButton />)

    const menuBtn = container.querySelector('[data-slot="top-header-menu"]')
    expect(menuBtn).toHaveClass('size-10')

    const branch = container.querySelector('[data-slot="top-header-branch"]')
    expect(branch).toHaveClass('h-10')

    const searchInput = screen.getByRole('searchbox', { name: 'جستجوی سراسری' })
    expect(searchInput).toHaveClass('h-10')

    const clock = container.querySelector('[data-slot="top-header-clock"]')
    expect(clock).toHaveClass('h-10')

    const notifications = container.querySelector('[data-slot="top-header-notifications"]')
    expect(notifications).toHaveClass('size-10')

    const quickAdd = container.querySelector('[data-slot="top-header-quick-add"]')
    expect(quickAdd).toHaveClass('size-10')

    const userMenu = container.querySelector('[data-slot="user-menu-trigger"]')
    expect(userMenu).toHaveClass('size-10')
  })
})
