import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

describe('Sheet', () => {
  it('opens drawer with dialog role and defaults to RTL end/left', async () => {
    const user = userEvent.setup()
    render(
      <Sheet>
        <SheetTrigger>کشو</SheetTrigger>
        <SheetContent>
          <SheetTitle>فرم سریع</SheetTitle>
          <SheetDescription>افزودن بچ</SheetDescription>
        </SheetContent>
      </Sheet>,
    )

    await user.click(screen.getByRole('button', { name: 'کشو' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('data-side', 'end')
    expect(dialog).toHaveAttribute('data-physical-side', 'left')
  })
})
