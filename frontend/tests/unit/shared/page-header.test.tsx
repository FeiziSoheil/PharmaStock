import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from '@/components/shared/page-header'

describe('PageHeader', () => {
  it('renders Persian title, description, and actions', () => {
    render(
      <PageHeader
        title="موجودی قفسه"
        description="نمای فشرده انبار"
        actions={<button type="button">خروجی</button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'موجودی قفسه' })).toBeInTheDocument()
    expect(screen.getByText('نمای فشرده انبار')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'خروجی' })).toBeInTheDocument()
  })
})
