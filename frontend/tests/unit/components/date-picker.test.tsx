import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DatePicker,
  parseIsoDateOnly,
  toIsoDateOnly,
} from '@/components/ui/date-picker'

describe('parseIsoDateOnly / toIsoDateOnly', () => {
  it('round-trips a local calendar date', () => {
    const parsed = parseIsoDateOnly('2026-11-12')
    expect(parsed).toBeInstanceOf(Date)
    expect(toIsoDateOnly(parsed!)).toBe('2026-11-12')
  })

  it('rejects invalid ISO dates', () => {
    expect(parseIsoDateOnly('2026-13-01')).toBeUndefined()
    expect(parseIsoDateOnly('11/12/2026')).toBeUndefined()
    expect(parseIsoDateOnly('')).toBeUndefined()
  })
})

describe('DatePicker', () => {
  it('opens the calendar and emits ISO on day select', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DatePicker
        data-testid="demo-date"
        value="2026-11-12"
        onChange={onChange}
      />,
    )

    await user.click(screen.getByTestId('demo-date'))
    const day = document.querySelector(
      '[data-slot="date-picker-content"] button[data-day="2026-11-01"]',
    )
    expect(day).toBeTruthy()
    await user.click(day as HTMLElement)
    expect(onChange).toHaveBeenCalledWith('2026-11-01')
  })
})
