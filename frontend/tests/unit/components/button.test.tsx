import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

afterEach(() => {
  cleanup()
})

describe('Button', () => {
  it('renders with button role and default variant', () => {
    render(<Button>ثبت</Button>)
    const btn = screen.getByRole('button', { name: 'ثبت' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('data-variant', 'default')
  })

  it('supports variants and sizes', () => {
    const { rerender } = render(
      <Button variant="destructive" size="sm">
        حذف
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'حذف' })).toHaveAttribute(
      'data-variant',
      'destructive',
    )
    expect(screen.getByRole('button', { name: 'حذف' })).toHaveAttribute(
      'data-size',
      'sm',
    )
    rerender(<Button variant="outline">حاشیه</Button>)
    expect(screen.getByRole('button', { name: 'حاشیه' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
  })

  it('exposes disabled and loading states', () => {
    const { rerender } = render(<Button disabled>غیرفعال</Button>)
    expect(screen.getByRole('button', { name: 'غیرفعال' })).toBeDisabled()
    rerender(<Button loading>ذخیره</Button>)
    const btn = screen.getByRole('button', { name: 'ذخیره' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toHaveAttribute('data-loading', 'true')
  })

  it('is keyboard activatable with Enter', async () => {
    const user = userEvent.setup()
    let clicked = false
    render(
      <Button
        onClick={() => {
          clicked = true
        }}
      >
        اقدام
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'اقدام' })
    btn.focus()
    expect(btn).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(clicked).toBe(true)
  })
})
