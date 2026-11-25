import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

describe('Tabs', () => {
  it('renders tablist and switches with arrow keys', async () => {
    const user = userEvent.setup()
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">موجودی</TabsTrigger>
          <TabsTrigger value="b">انقضا</TabsTrigger>
        </TabsList>
        <TabsContent value="a">محتوای موجودی</TabsContent>
        <TabsContent value="b">محتوای انقضا</TabsContent>
      </Tabs>,
    )

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    const first = screen.getByRole('tab', { name: 'موجودی' })
    expect(first).toHaveAttribute('aria-selected', 'true')
    first.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'انقضا' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText('محتوای انقضا')).toBeInTheDocument()
  })
})
