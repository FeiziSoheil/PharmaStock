import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

describe('Breadcrumb', () => {
  it('renders navigation landmark with separators', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">خانه</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>گالری</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    )

    expect(screen.getByRole('navigation', { name: 'مسیر صفحه' })).toBeInTheDocument()
    expect(screen.getByText('خانه')).toBeInTheDocument()
    expect(screen.getByText('گالری')).toHaveAttribute('aria-current', 'page')
    expect(document.querySelector('[data-slot="breadcrumb-separator"]')).toBeTruthy()
  })
})
