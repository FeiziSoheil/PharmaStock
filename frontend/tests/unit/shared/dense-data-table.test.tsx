import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DenseDataTable,
  type DenseColumn,
} from '@/components/shared/dense-data-table'

type Row = { id: string; sku: string; name: string }

const columns: DenseColumn<Row>[] = [
  { id: 'name', header: 'نام', cell: (row) => row.name },
  { id: 'sku', header: 'SKU', dir: 'ltr', cell: (row) => row.sku },
]

describe('DenseDataTable', () => {
  it('renders mixed-dir cells and empty state', () => {
    const { rerender } = render(
      <DenseDataTable
        columns={columns}
        data={[{ id: '1', sku: 'IRC-1', name: 'استامینوفن' }]}
        getRowId={(row) => row.id}
      />,
    )
    expect(screen.getByText('استامینوفن')).toBeInTheDocument()
    expect(screen.getByText('IRC-1')).toHaveAttribute('dir', 'ltr')

    const frame = document.querySelector('[data-slot="dense-data-table"]')
    expect(frame).toHaveClass('border-border-default', 'shadow-none')
    expect(document.querySelector('[data-slot="table-header"]')).toHaveClass(
      'shadow-none',
    )

    rerender(
      <DenseDataTable columns={columns} data={[]} getRowId={(row) => row.id} />,
    )
    expect(screen.getByText('موردی برای نمایش وجود ندارد')).toBeInTheDocument()
  })

  it('supports keyboard activation when onRowClick is set', async () => {
    const onRowClick = vi.fn()
    render(
      <DenseDataTable
        columns={columns}
        data={[{ id: '1', sku: 'IRC-1', name: 'دارو' }]}
        getRowId={(row) => row.id}
        onRowClick={onRowClick}
      />,
    )
    const row = screen.getByText('دارو').closest('tr')
    expect(row).toHaveAttribute('tabIndex', '0')
    row?.focus()
    row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })
})
