import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

describe('Input', () => {
  it('renders textbox and associates with label', () => {
    render(
      <>
        <Label htmlFor="drug">نام دارو</Label>
        <Input id="drug" />
      </>,
    )
    expect(screen.getByLabelText('نام دارو')).toBeInTheDocument()
  })

  it('marks error state with aria-invalid', () => {
    render(<Input error aria-label="سری" />)
    expect(screen.getByLabelText('سری')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('سری')).toHaveAttribute('data-state', 'error')
  })

  it('supports disabled and typing', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Input aria-label="کد" />)
    const input = screen.getByLabelText('کد')
    await user.type(input, 'ABC')
    expect(input).toHaveValue('ABC')
    rerender(<Input aria-label="کد" disabled />)
    expect(screen.getByLabelText('کد')).toBeDisabled()
  })
})
