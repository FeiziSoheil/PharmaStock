import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ActionTooltip } from '@/components/shared/action-tooltip'

describe('ActionTooltip', () => {
  it('renders trigger element and displays title on hover', async () => {
    const user = userEvent.setup()

    render(
      <ActionTooltip title="مشاهده کاردکس کالا">
        <button type="button">کاردکس</button>
      </ActionTooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'کاردکس' })
    expect(trigger).toBeInTheDocument()

    // Hover trigger
    await user.hover(trigger)

    // Check tooltip title
    expect(await screen.findByText('مشاهده کاردکس کالا')).toBeInTheDocument()
  })
})
