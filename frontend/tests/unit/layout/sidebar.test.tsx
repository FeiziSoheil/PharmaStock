import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Sidebar } from '@/components/layout/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getAppNavItems } from '@/lib/nav/app-nav'

const items = [
  { id: 'dash', label: 'داشبورد', href: '/shell', icon: 'dashboard' as const, active: true, section: 'پیشخوان و آمار' },
  { id: 'meds', label: 'موجودی', href: '/shell#table', icon: 'medication' as const, section: 'اطلاعات پایه و کاتالوگ' },
]

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders expanded nav labels', () => {
    render(
      <TooltipProvider>
        <Sidebar items={items} />
      </TooltipProvider>,
    )
    expect(screen.getByLabelText('ناوبری اصلی')).toHaveAttribute('data-collapsed', 'false')
    expect(screen.getByRole('link', { name: /داشبورد/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('موجودی')).toBeInTheDocument()
  })

  it('collapses to icon rail with accessible labels', () => {
    render(
      <TooltipProvider>
        <Sidebar items={items} collapsed />
      </TooltipProvider>,
    )
    expect(screen.getByLabelText('ناوبری اصلی')).toHaveAttribute('data-collapsed', 'true')
    expect(screen.getByRole('link', { name: 'داشبورد' })).toBeInTheDocument()
    expect(screen.getByText('موجودی')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders section headers when expanded', () => {
    render(
      <TooltipProvider>
        <Sidebar items={items} />
      </TooltipProvider>,
    )
    expect(screen.getByText('پیشخوان و آمار')).toBeInTheDocument()
    expect(screen.getByText('اطلاعات پایه و کاتالوگ')).toBeInTheDocument()
  })

  it('renders dividers between sections when collapsed', () => {
    const { container } = render(
      <TooltipProvider>
        <Sidebar items={items} collapsed />
      </TooltipProvider>,
    )
    const dividers = container.querySelectorAll('[data-slot="sidebar-nav-section-divider"]')
    expect(dividers.length).toBe(1)
  })

  it('renders all 5 canonical sections using getAppNavItems', () => {
    const navItems = getAppNavItems('dashboard')
    render(
      <TooltipProvider>
        <Sidebar items={navItems} />
      </TooltipProvider>,
    )
    expect(screen.getByText('پیشخوان و آمار')).toBeInTheDocument()
    expect(screen.getByText('اطلاعات پایه و کاتالوگ')).toBeInTheDocument()
    expect(screen.getByText('ورود و خروج کالا')).toBeInTheDocument()
    expect(screen.getByText('کنترل کیفیت و زنجیره تأمین')).toBeInTheDocument()
    expect(screen.getByText('نظارت و سیستم')).toBeInTheDocument()
  })

  it('toggles collapsible section when section header button is clicked', () => {
    render(
      <TooltipProvider>
        <Sidebar items={items} />
      </TooltipProvider>,
    )
    const toggleBtn = screen.getByRole('button', { name: /اطلاعات پایه و کاتالوگ/ })
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('restores persisted collapsed sections from localStorage', () => {
    localStorage.setItem(
      'pharmastock_sidebar_collapsed_sections',
      JSON.stringify({ 'اطلاعات پایه و کاتالوگ': true }),
    )
    render(
      <TooltipProvider>
        <Sidebar items={items} />
      </TooltipProvider>,
    )
    expect(
      screen.getByRole('button', { name: /اطلاعات پایه و کاتالوگ/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByRole('button', { name: /پیشخوان و آمار/ }),
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
