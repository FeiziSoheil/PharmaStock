import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from '@/components/shared/pagination'

describe('Pagination', () => {
  it('navigates pages with RTL-labeled controls', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        page={2}
        pageCount={5}
        totalItems={48}
        onPageChange={onPageChange}
      />,
    )
    expect(screen.getByLabelText('صفحه‌بندی')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'صفحه بعد' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
    await user.click(screen.getByRole('button', { name: 'صفحه قبل' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})
