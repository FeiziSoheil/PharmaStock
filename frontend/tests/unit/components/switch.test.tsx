import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

describe('Switch', () => {
  it('renders switch role and toggles with keyboard', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Switch id="alerts" />
        <Label htmlFor="alerts">هشدار</Label>
      </>,
    )
    const sw = screen.getByRole('switch', { name: 'هشدار' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    sw.focus()
    await user.keyboard(' ')
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })
})
