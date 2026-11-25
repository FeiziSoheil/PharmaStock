import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

describe('Checkbox', () => {
  it('toggles with click and Space', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Checkbox id="fefo" />
        <Label htmlFor="fefo">FEFO</Label>
      </>,
    )
    const box = screen.getByRole('checkbox', { name: 'FEFO' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await user.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')
    box.focus()
    await user.keyboard(' ')
    expect(box).toHaveAttribute('aria-checked', 'false')
  })
})
