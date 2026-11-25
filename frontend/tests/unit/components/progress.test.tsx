import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Progress } from '@/components/ui/progress'

describe('Progress', () => {
  it('exposes progressbar with value', () => {
    render(<Progress value={68} aria-label="پیشرفت" />)
    const bar = screen.getByRole('progressbar', { name: 'پیشرفت' })
    expect(bar).toHaveAttribute('aria-valuenow', '68')
  })
})
