import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AlertBanner } from '@/components/shared/alert-banner'

describe('AlertBanner', () => {
  it('renders tone and dismisses', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <AlertBanner
        tone="critical"
        title="کسری صفر"
        description="قفسه کنترل‌شده"
        onDismiss={onDismiss}
      />,
    )
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'critical')
    expect(screen.getByText('کسری صفر')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'بستن اعلان' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
