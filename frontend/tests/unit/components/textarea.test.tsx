import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Textarea } from '@/components/ui/textarea'

afterEach(() => {
  cleanup()
})

describe('Textarea', () => {
  it('renders textbox role and accepts input', async () => {
    const user = userEvent.setup()
    render(<Textarea aria-label="یادداشت" />)
    const area = screen.getByRole('textbox', { name: 'یادداشت' })
    await user.type(area, 'تست')
    expect(area).toHaveValue('تست')
  })

  it('supports error and disabled states', () => {
    const { rerender } = render(<Textarea aria-label="یادداشت خطا" error />)
    expect(screen.getByRole('textbox', { name: 'یادداشت خطا' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    rerender(<Textarea aria-label="یادداشت خطا" disabled />)
    expect(screen.getByRole('textbox', { name: 'یادداشت خطا' })).toBeDisabled()
  })
})
