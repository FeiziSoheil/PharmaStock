import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TriageStatusBadge } from '@/components/shared/triage-status-badge'

describe('TriageStatusBadge', () => {
  it('renders Stitch status with default Persian label and icon', () => {
    render(<TriageStatusBadge status="expiring" />)
    const badge = screen.getByText('نزدیک انقضا')
    expect(badge).toHaveAttribute('data-status', 'expiring')
    expect(badge).toHaveAttribute('data-variant', 'expiring')
    expect(badge.querySelector('[data-slot="icon"]')).toBeTruthy()
  })

  it('accepts custom children', () => {
    render(<TriageStatusBadge status="critical">منقضی</TriageStatusBadge>)
    expect(screen.getByText('منقضی')).toHaveAttribute('data-status', 'critical')
  })
})
