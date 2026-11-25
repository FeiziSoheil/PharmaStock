import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'

describe('ConfirmDialog', () => {
  it('opens from trigger and confirms', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        title="تأیید حذف"
        description="غیرقابل بازگشت"
        tone="critical"
        onConfirm={onConfirm}
        trigger={<Button type="button">باز کردن</Button>}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'باز کردن' }))
    expect(await screen.findByRole('heading', { name: 'تأیید حذف' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'تأیید و ثبت' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
