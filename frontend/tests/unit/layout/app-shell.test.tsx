import * as React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/components/layout/app-shell'
import { SideDrawer } from '@/components/shared/side-drawer'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'

const items = [
  { id: 'dash', label: 'داشبورد', href: '/shell', icon: 'dashboard' as const, active: true },
]

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear()
    setWidth(1400)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses full sidebar on desktop and toggles collapse', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <AppShell navItems={items}>
          <h1>محتوا</h1>
        </AppShell>
      </TooltipProvider>,
    )

    const shell = document.querySelector('[data-slot="app-shell"]')
    expect(shell).toHaveAttribute('data-layout-mode', 'desktop')
    expect(shell).toHaveAttribute('data-sidebar-collapsed', 'false')
    expect(shell).toHaveClass('bg-shell')
    expect(
      document.querySelector('[data-slot="app-shell-island-sidebar"]'),
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="app-shell-island-header"]'),
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="app-shell-island-content"]'),
    ).toBeTruthy()
    expect(screen.getByLabelText('ناوبری اصلی')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'جمع کردن نوار کناری' }))
    expect(shell).toHaveAttribute('data-sidebar-collapsed', 'true')
  })

  it('forces rail on tablet and off-canvas on mobile', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <TooltipProvider>
        <AppShell navItems={items}>
          <p>بدنه</p>
        </AppShell>
      </TooltipProvider>,
    )

    await act(async () => {
      setWidth(900)
    })
    rerender(
      <TooltipProvider>
        <AppShell navItems={items}>
          <p>بدنه</p>
        </AppShell>
      </TooltipProvider>,
    )
    expect(document.querySelector('[data-slot="app-shell"]')).toHaveAttribute(
      'data-layout-mode',
      'tablet',
    )
    expect(document.querySelector('[data-slot="app-shell"]')).toHaveAttribute(
      'data-sidebar-collapsed',
      'true',
    )

    await act(async () => {
      setWidth(390)
    })
    rerender(
      <TooltipProvider>
        <AppShell navItems={items}>
          <p>بدنه</p>
        </AppShell>
      </TooltipProvider>,
    )
    expect(document.querySelector('[data-slot="app-shell"]')).toHaveAttribute(
      'data-layout-mode',
      'mobile',
    )
    expect(
      document.querySelector('[data-slot="app-shell-island-sidebar"]'),
    ).toBeNull()
    expect(
      document.querySelector('[data-slot="app-shell-island-header"]'),
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="app-shell-island-content"]'),
    ).toBeTruthy()
    expect(screen.queryByLabelText('ناوبری اصلی')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'باز کردن منو' }))
    expect(await screen.findByLabelText('ناوبری اصلی')).toBeInTheDocument()
  })

  it('pushes a third drawer island and shrinks the main column on desktop', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <TooltipProvider>
          <AppShell navItems={items}>
            <Button type="button" onClick={() => setOpen(true)}>
              باز کردن کشو
            </Button>
            <SideDrawer
              open={open}
              onOpenChange={setOpen}
              title="جزئیات انبار"
              description="پیش‌نمایش"
            >
              <p>بدنه کشو</p>
            </SideDrawer>
          </AppShell>
        </TooltipProvider>
      )
    }

    render(<Harness />)

    const shell = document.querySelector('[data-slot="app-shell"]')
    expect(shell).toHaveAttribute('data-drawer-open', 'false')
    const drawer = document.querySelector('[data-slot="app-shell-island-drawer"]')
    expect(drawer).toHaveAttribute('data-state', 'closed')

    await user.click(screen.getByRole('button', { name: 'باز کردن کشو' }))
    expect(shell).toHaveAttribute('data-drawer-open', 'true')
    expect(drawer).toHaveAttribute('data-state', 'open')
    expect(drawer).toHaveAttribute('data-pattern', 'side-drawer')
    expect(screen.getByText('بدنه کشو')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'جزئیات انبار' })).toBeInTheDocument()
  })
})
