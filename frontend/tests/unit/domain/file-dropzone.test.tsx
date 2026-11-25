import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FileDropzone } from '@/components/domain/file-dropzone'

describe('FileDropzone', () => {
  it('renders title', () => {
    render(<FileDropzone title="بارگذاری فایل فاکتور" />)
    expect(screen.getByText('بارگذاری فایل فاکتور')).toBeInTheDocument()
  })

  it('keyboard Enter triggers file input click', async () => {
    const user = userEvent.setup()
    render(<FileDropzone title="بارگذاری فایل" />)

    const zone = screen.getByRole('button', { name: 'بارگذاری فایل' })
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    zone.focus()
    await user.keyboard('{Enter}')

    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('calls onFilesSelected when input change fires with File', async () => {
    const user = userEvent.setup()
    const onFilesSelected = vi.fn()
    render(
      <FileDropzone
        title="بارگذاری فایل"
        accept=".xlsx,.csv"
        onFilesSelected={onFilesSelected}
      />,
    )

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const file = new File(['a,b,c'], 'invoice.csv', { type: 'text/csv' })

    await user.upload(input, file)

    expect(onFilesSelected).toHaveBeenCalledTimes(1)
    expect(onFilesSelected.mock.calls[0]?.[0]?.[0]?.name).toBe('invoice.csv')
  })

  it('disabled prevents interaction', async () => {
    const user = userEvent.setup()
    const onFilesSelected = vi.fn()
    render(
      <FileDropzone
        title="بارگذاری فایل"
        disabled
        onFilesSelected={onFilesSelected}
      />,
    )

    const zone = screen.getByRole('button', { name: 'بارگذاری فایل' })
    expect(zone).toHaveAttribute('aria-disabled', 'true')
    expect(zone).toHaveAttribute('tabindex', '-1')

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    await user.click(zone)
    expect(clickSpy).not.toHaveBeenCalled()

    clickSpy.mockRestore()
    expect(onFilesSelected).not.toHaveBeenCalled()
  })

  it('exposes data-slot="file-dropzone"', () => {
    const { container } = render(<FileDropzone />)
    expect(
      container.querySelector('[data-slot="file-dropzone"]'),
    ).toBeInTheDocument()
  })
})
