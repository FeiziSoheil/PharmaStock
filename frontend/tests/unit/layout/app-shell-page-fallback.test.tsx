import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShellPageFallback } from '@/components/layout/app-shell-page-fallback'
import { TooltipProvider } from '@/components/ui/tooltip'

describe('AppShellPageFallback', () => {
  it('keeps shell chrome and loads only the content panel', () => {
    render(
      <TooltipProvider>
        <AppShellPageFallback
          activeNavId="audit-log"
          message="در حال بارگذاری لاگ ممیزی…"
        />
      </TooltipProvider>,
    )

    expect(
      document.querySelector('[data-slot="app-shell"]'),
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="app-shell-island-sidebar"]'),
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="app-shell-island-header"]'),
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="app-shell-island-content"]'),
    ).toBeTruthy()

    const panel = document.querySelector(
      '[data-slot="app-shell-page-fallback"]',
    )
    expect(panel).toBeTruthy()
    expect(panel).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('در حال بارگذاری لاگ ممیزی…')).toBeInTheDocument()

    expect(
      document.querySelector('.min-h-screen.items-center.justify-center'),
    ).toBeNull()
  })
})
