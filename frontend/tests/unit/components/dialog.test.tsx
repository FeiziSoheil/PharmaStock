import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

describe('Dialog', () => {
  it('opens via trigger and closes with Escape', async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger>باز کردن</DialogTrigger>
        <DialogContent>
          <DialogTitle>تأیید</DialogTitle>
          <DialogDescription>آیا مطمئن هستید؟</DialogDescription>
        </DialogContent>
      </Dialog>,
    )

    await user.click(screen.getByRole('button', { name: 'باز کردن' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'تأیید' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
