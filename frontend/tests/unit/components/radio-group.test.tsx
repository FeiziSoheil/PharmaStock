import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

afterEach(() => {
  cleanup()
})

describe('RadioGroup', () => {
  it('exposes radiogroup role and selects via click', async () => {
    const user = userEvent.setup()
    render(
      <RadioGroup defaultValue="a">
        <div>
          <RadioGroupItem value="a" id="a" />
          <Label htmlFor="a">گزینه الف</Label>
        </div>
        <div>
          <RadioGroupItem value="b" id="b" />
          <Label htmlFor="b">گزینه ب</Label>
        </div>
      </RadioGroup>,
    )
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'گزینه الف' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'گزینه ب' }))
    expect(screen.getByRole('radio', { name: 'گزینه ب' })).toBeChecked()
  })
})
