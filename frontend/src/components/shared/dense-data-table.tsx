import * as React from 'react'
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type DenseColumnAlign = 'start' | 'end'
export type DenseColumnDir = 'rtl' | 'ltr' | 'auto'

export type DenseColumn<T> = {
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** Logical alignment (start = right in RTL). Default start. */
  align?: DenseColumnAlign
  /** Force direction for mixed-content cells (SKU, date, currency). */
  dir?: DenseColumnDir
  className?: string
  headerClassName?: string
  /** Optional ARIA sort state for sortable column headers. */
  ariaSort?: React.AriaAttributes['aria-sort']
}

export type DenseDataTableProps<T> = {
  columns: DenseColumn<T>[]
  data: T[]
  getRowId: (row: T) => string
  stickyHeader?: boolean
  /** Enables vertical scroll + sticky thead (e.g. `min(420px, 50vh)`). */
  maxHeight?: string
  caption?: string
  emptyMessage?: string
  className?: string
  onRowClick?: (row: T) => void
}

/**
 * Dense clinical inventory table composed from Phase C Table primitives.
 * Soft-border frame (no drop shadow); sticky header uses a soft bottom rule.
 * Supports sticky header, tabular nums, and mixed-dir cells (IDs / SKUs / dates / currency).
 */
function DenseDataTable<T>({
  columns,
  data,
  getRowId,
  stickyHeader = true,
  maxHeight = 'min(28rem, 55vh)',
  caption,
  emptyMessage = 'موردی برای نمایش وجود ندارد',
  className,
  onRowClick,
}: DenseDataTableProps<T>) {
  return (
    <div
      data-slot="dense-data-table"
      className={cn(
        'ps-hide-scrollbar relative w-full overflow-auto rounded-default border border-border-default bg-surface shadow-none',
        className,
      )}
      style={stickyHeader ? { maxHeight } : undefined}
    >
      <table
        data-slot="table"
        className="w-full caption-bottom text-body-sm"
      >
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader
        className={cn(
          stickyHeader
            ? 'sticky top-0 z-[var(--ps-z-sticky)] bg-surface-muted/95 shadow-none backdrop-blur-sm [&_tr]:border-b-2 [&_tr]:border-border-strong'
            : 'static shadow-none [&_tr]:border-b [&_tr]:border-border-default',
        )}
      >
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => (
            <TableHead
              key={column.id}
              dir={column.dir === 'auto' ? undefined : column.dir}
              aria-sort={column.ariaSort}
              className={cn(
                column.align === 'end' && 'text-end',
                column.headerClassName,
              )}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-text-secondary"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row) => (
            <TableRow
              key={getRowId(row)}
              data-row-id={getRowId(row)}
              className={onRowClick ? 'cursor-pointer' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onRowClick(row)
                      }
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  dir={column.dir === 'auto' ? undefined : column.dir}
                  className={cn(
                    'tabular-nums-data',
                    column.align === 'end' && 'text-end',
                    column.dir === 'ltr' && 'font-latin',
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
      </table>
    </div>
  )
}

export { DenseDataTable }
