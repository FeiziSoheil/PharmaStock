import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('renders status variants', () => {
    const { rerender } = render(<Badge variant="valid">معتبر</Badge>)
    expect(screen.getByText('معتبر')).toHaveAttribute('data-variant', 'valid')
    rerender(<Badge variant="critical">بحرانی</Badge>)
    expect(screen.getByText('بحرانی')).toHaveAttribute('data-variant', 'critical')
  })
})
