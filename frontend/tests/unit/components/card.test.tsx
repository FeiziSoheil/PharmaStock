import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

describe('Card', () => {
  it('composes header title and content without nested cards', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>شاخص</CardTitle>
          <CardDescription>توضیح</CardDescription>
        </CardHeader>
        <CardContent>۲۴</CardContent>
      </Card>,
    )
    expect(screen.getByText('شاخص')).toBeInTheDocument()
    expect(screen.getByText('توضیح')).toBeInTheDocument()
    expect(screen.getByText('۲۴')).toBeInTheDocument()
    const card = document.querySelector('[data-slot="card"]')
    expect(card).toBeInTheDocument()
    expect(card).toHaveClass('border-border-default', 'shadow-none')
  })
})
