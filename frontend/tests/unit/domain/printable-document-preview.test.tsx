import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PrintableDocumentPreview } from '@/components/domain/printable-document-preview'

describe('PrintableDocumentPreview', () => {
  it('renders title, documentTitle, and table rows', () => {
    render(
      <PrintableDocumentPreview
        title="پیش‌نمایش سند رسمی استرداد"
        documentTitle="صورت‌جلسه مرجوعی کالا"
        columns={['ردیف', 'شرح', 'بچ']}
        lines={[
          { id: '1', cells: ['۱', 'سفالکسین', 'CX500-449'] },
          { id: '2', cells: ['۲', 'دگزامتازون', 'DX-04'] },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'پیش‌نمایش سند رسمی استرداد' })).toBeInTheDocument()
    expect(screen.getByText('صورت‌جلسه مرجوعی کالا')).toBeInTheDocument()
    expect(screen.getByText('سفالکسین')).toBeInTheDocument()
    expect(screen.getByText('دگزامتازون')).toBeInTheDocument()
    expect(screen.getByText('CX500-449')).toBeInTheDocument()
  })

  it('calls onPrint when print button is clicked', async () => {
    const user = userEvent.setup()
    const onPrint = vi.fn()

    render(
      <PrintableDocumentPreview
        title="پیش‌نمایش"
        documentTitle="صورت‌جلسه"
        columns={['ردیف']}
        lines={[{ id: '1', cells: ['۱'] }]}
        onPrint={onPrint}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'چاپ مستقیم سند' }))
    expect(onPrint).toHaveBeenCalledTimes(1)
  })

  it('exposes printable-area data-slot', () => {
    const { container } = render(
      <PrintableDocumentPreview
        title="پیش‌نمایش"
        documentTitle="صورت‌جلسه"
        columns={['ردیف']}
        lines={[{ id: '1', cells: ['۱'] }]}
      />,
    )

    expect(
      container.querySelector('[data-slot="printable-document-preview"]'),
    ).toBeTruthy()
    const area = container.querySelector('[data-slot="printable-area"]')
    expect(area).toBeTruthy()
    expect(area).toHaveAttribute('dir', 'rtl')
  })

  it('renders meta ltr values with latin styling', () => {
    render(
      <PrintableDocumentPreview
        title="پیش‌نمایش"
        documentTitle="صورت‌جلسه مرجوعی کالا"
        meta={[
          { label: 'شماره حواله:', value: 'RET-40308-012', dir: 'ltr' },
          { label: 'تاریخ صدور:', value: '۱۴۰۳/۰۸/۲۰' },
        ]}
        columns={['ردیف']}
        lines={[{ id: '1', cells: ['۱'] }]}
      />,
    )

    const code = screen.getByText('RET-40308-012')
    expect(code).toBeInTheDocument()
    expect(code).toHaveAttribute('dir', 'ltr')
    expect(code.className).toMatch(/font-latin/)
    expect(screen.getByText('۱۴۰۳/۰۸/۲۰')).toBeInTheDocument()
  })
})
