import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

describe('Table', () => {
  it('renders table roles with mixed FA/EN and tabular cells', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>نام</TableHead>
            <TableHead>موجودی</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              استامینوفن <span dir="ltr">(Acetaminophen)</span>
            </TableCell>
            <TableCell>۱٬۲۴۰</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'نام' })).toBeInTheDocument()
    expect(screen.getByText(/Acetaminophen/)).toBeInTheDocument()
    expect(screen.getByText('۱٬۲۴۰').className).toContain('tabular-nums-data')

    const container = document.querySelector('[data-slot="table-container"]')
    expect(container).toHaveClass('border-border-default', 'shadow-none')
  })
})
