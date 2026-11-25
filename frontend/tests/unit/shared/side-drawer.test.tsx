import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SideDrawer } from '@/components/shared/side-drawer'
import { Button } from '@/components/ui/button'

describe('SideDrawer', () => {
  it('opens end-side drawer with title', async () => {
    const user = userEvent.setup()
    render(
      <SideDrawer
        title="افزودن سری ساخت"
        description="ثبت بچ"
        trigger={<Button type="button">کشوی کناری</Button>}
      >
        <p>محتوای فرم</p>
      </SideDrawer>,
    )
    await user.click(screen.getByRole('button', { name: 'کشوی کناری' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-pattern', 'side-drawer')
    expect(dialog).toHaveAttribute('data-side', 'end')
    expect(screen.getByRole('heading', { name: 'افزودن سری ساخت' })).toBeInTheDocument()
    expect(screen.getByText('محتوای فرم')).toBeInTheDocument()
  })
})
