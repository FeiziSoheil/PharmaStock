import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WarehouseRackGrid,
  type RackCell,
} from '@/components/domain/warehouse-rack-grid'

afterEach(() => {
  cleanup()
})

const CELL_STATUSES = [
  'empty',
  'occupied',
  'low',
  'expiring',
  'controlled',
  'critical',
  'quarantine',
] as const satisfies readonly RackCell['status'][]

function makeCells(count: number): RackCell[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c-${i}`,
    label: `A-0${i}`,
    status: CELL_STATUSES[i % CELL_STATUSES.length]!,
    title: i === 0 ? 'سبد نمونه' : undefined,
  }))
}

describe('WarehouseRackGrid', () => {
  it('renders grid role and data-slot', () => {
    render(
      <WarehouseRackGrid columns={3} cells={makeCells(6)} legend />,
    )

    expect(screen.getByRole('grid', { name: 'نقشه قفسه انبار' })).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="warehouse-rack-grid"]'),
    ).toBeInTheDocument()
  })

  it('click selects and calls onSelect', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <WarehouseRackGrid
        columns={3}
        cells={makeCells(6)}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('gridcell', { name: /A-02/ }))
    expect(onSelect).toHaveBeenCalledWith('c-2')
  })

  it('marks selected cell with aria-selected', () => {
    render(
      <WarehouseRackGrid
        columns={3}
        cells={makeCells(6)}
        selectedId="c-1"
      />,
    )

    const selected = screen.getByRole('gridcell', { name: /A-01/ })
    expect(selected).toHaveAttribute('aria-selected', 'true')

    const other = screen.getByRole('gridcell', { name: /A-02/ })
    expect(other).toHaveAttribute('aria-selected', 'false')
  })

  it('arrow keys move focus between cells (RTL: ArrowLeft → higher column index)', async () => {
    const user = userEvent.setup()
    render(<WarehouseRackGrid columns={3} cells={makeCells(6)} />)

    const grid = screen.getByRole('grid')
    const first = within(grid).getByRole('gridcell', { name: /A-00/ })
    first.focus()
    expect(first).toHaveFocus()

    // RTL: ArrowLeft moves visually left = column index + 1 (same row)
    await user.keyboard('{ArrowLeft}')
    expect(
      within(grid).getByRole('gridcell', { name: /A-01/ }),
    ).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(
      within(grid).getByRole('gridcell', { name: /A-04/ }),
    ).toHaveFocus()
  })

  it('Enter and Space select the focused cell', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <WarehouseRackGrid
        columns={3}
        cells={makeCells(3)}
        onSelect={onSelect}
      />,
    )

    const cell = screen.getByRole('gridcell', { name: /A-00/ })
    cell.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('c-0')

    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledWith('c-0')
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('Home and End jump within the current row', async () => {
    const user = userEvent.setup()
    render(<WarehouseRackGrid columns={3} cells={makeCells(6)} />)

    const grid = screen.getByRole('grid')
    const mid = within(grid).getByRole('gridcell', { name: /A-01/ })
    mid.focus()

    await user.keyboard('{End}')
    expect(
      within(grid).getByRole('gridcell', { name: /A-02/ }),
    ).toHaveFocus()

    await user.keyboard('{Home}')
    expect(
      within(grid).getByRole('gridcell', { name: /A-00/ }),
    ).toHaveFocus()
  })

  it('exposes expiring and controlled status tokens distinctly', () => {
    render(
      <WarehouseRackGrid
        columns={2}
        cells={[
          { id: 'e1', label: 'E-01', status: 'expiring' },
          { id: 'c1', label: 'C-01', status: 'controlled' },
        ]}
        legend
      />,
    )

    expect(
      screen.getByRole('gridcell', { name: /E-01، نزدیک انقضا/ }),
    ).toHaveAttribute('data-status', 'expiring')
    expect(
      screen.getByRole('gridcell', { name: /C-01، تحت کنترل/ }),
    ).toHaveAttribute('data-status', 'controlled')
    expect(screen.getByText('نزدیک انقضا')).toBeInTheDocument()
    expect(screen.getByText('تحت کنترل')).toBeInTheDocument()
  })
})
