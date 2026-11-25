import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
})

describe('Select', () => {
  it('renders combobox and selects an option', async () => {
    const user = userEvent.setup()
    render(
      <Select defaultValue="room">
        <SelectTrigger aria-label="شرایط">
          <SelectValue placeholder="انتخاب" />
        </SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectGroup>
            <SelectItem value="room">دمای اتاق</SelectItem>
            <SelectItem value="fridge">یخچال</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    )

    const trigger = screen.getByRole('combobox', { name: 'شرایط' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveTextContent('دمای اتاق')

    await user.click(trigger)
    const fridge = await screen.findByRole('option', { name: 'یخچال' })
    await user.click(fridge)
    expect(trigger).toHaveTextContent('یخچال')
  })
})
