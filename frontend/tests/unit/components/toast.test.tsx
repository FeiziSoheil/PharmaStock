import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'

describe('Toast (Sonner)', () => {
  it('renders success toast from trigger', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Toaster />
        <Button onClick={() => toast.success('ذخیره شد')}>نمایش</Button>
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'نمایش' }))
    await waitFor(() => {
      expect(screen.getByText('ذخیره شد')).toBeInTheDocument()
    })
  })
})
