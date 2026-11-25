import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SettingsView } from '@/app/settings/settings-view'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppearanceProvider } from '@/lib/settings/appearance-context'
import { fallbackDefaultSettings } from '@/lib/settings/data-access'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/settings',
}))

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AppearanceProvider>
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
    </AppearanceProvider>,
  )
}

describe('SettingsView', () => {
  it('renders Persian main headings and all 5 settings tabs including appearance', () => {
    renderWithProviders(<SettingsView initialSettings={fallbackDefaultSettings} />)

    expect(
      screen.getByRole('heading', { level: 1, name: /تنظیمات سیستم و انبار دارو/i }),
    ).toBeInTheDocument()

    expect(screen.getByText('هویت و چاپ اسناد')).toBeInTheDocument()
    expect(screen.getByText('قوانین انبار و FEFO')).toBeInTheDocument()
    expect(screen.getByText('ظاهر و رابط کاربری')).toBeInTheDocument()
    expect(screen.getByText('سامانه تیتک (TTAC)')).toBeInTheDocument()
    expect(screen.getByText('امنیت و ممیزی')).toBeInTheDocument()

    expect(screen.getByDisplayValue('داروخانه دکتر حسینی')).toBeInTheDocument()
  })

  it('allows switching to appearance tab and selecting hospital blue theme', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsView initialSettings={fallbackDefaultSettings} />)

    const appearanceTab = screen.getByRole('tab', { name: /ظاهر و رابط کاربری/i })
    await user.click(appearanceTab)

    expect(screen.getByText('پوسته رنگی و تم سامانه')).toBeInTheDocument()
    expect(screen.getByText('تراکم سطرهای جدول و داده‌ها')).toBeInTheDocument()

    const hospitalThemeOption = screen.getByText(/آبی بیمارستانی/i)
    await user.click(hospitalThemeOption)

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('hospital-blue')
    })
  })

  it('detects dirty state when an input is changed and enables save button', async () => {
    renderWithProviders(<SettingsView initialSettings={fallbackDefaultSettings} />)

    const nameInput = screen.getByDisplayValue('داروخانه دکتر حسینی')
    fireEvent.change(nameInput, { target: { value: 'داروخانه نمونه پاستور' } })

    expect(screen.getByText('تغییرات ذخیره‌نشده')).toBeInTheDocument()

    const saveBtn = screen.getByRole('button', { name: /ذخیره تغییرات/i })
    expect(saveBtn).not.toBeDisabled()

    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByDisplayValue('داروخانه نمونه پاستور')).toBeInTheDocument()
    })
  })
})
