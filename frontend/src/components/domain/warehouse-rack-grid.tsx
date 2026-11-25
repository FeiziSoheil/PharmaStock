'use client'

import * as React from 'react'
import { Icon } from '@/components/ui/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { IconName } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type RackCellStatus =
  | 'empty'
  | 'occupied'
  | 'low'
  | 'expiring'
  | 'controlled'
  | 'critical'
  | 'quarantine'

export type RackCell = {
  id: string
  /** e.g. A-04-3-12 */
  label: string
  status: RackCellStatus
  /** tooltip / accessible name detail */
  title?: string
  disabled?: boolean
}

export type WarehouseRackGridProps = {
  columns: number
  /** length should be rows*columns; component derives rows */
  cells: RackCell[]
  selectedId?: string | null
  onSelect?: (cellId: string) => void
  rowLabels?: string[]
  columnLabels?: string[]
  legend?: boolean
  className?: string
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const

function toPersianDigits(value: number | string): string {
  return String(value).replace(
    /\d/g,
    (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit,
  )
}

const STATUS_LABELS: Record<RackCellStatus, string> = {
  empty: 'خالی',
  occupied: 'اشغال',
  low: 'موجودی کم',
  expiring: 'نزدیک انقضا',
  controlled: 'تحت کنترل',
  critical: 'بحرانی',
  quarantine: 'قرنطینه',
}

const STATUS_ICONS: Record<RackCellStatus, IconName> = {
  empty: 'inventory_2',
  occupied: 'check_circle',
  low: 'warning',
  expiring: 'event_busy',
  controlled: 'lock',
  critical: 'dangerous',
  quarantine: 'block',
}

/** Occupancy colors via Phase B triage/status tokens. */
const STATUS_CELL: Record<RackCellStatus, string> = {
  empty:
    'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
  occupied:
    'border-status-valid-border bg-status-valid-bg text-status-valid-fg',
  low: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
  expiring:
    'border-status-expiring-border bg-status-expiring-bg text-status-expiring-fg',
  controlled:
    'border-status-critical-border bg-status-critical-bg text-status-critical-fg',
  critical:
    'border-status-critical-border bg-status-critical-bg text-status-critical-fg',
  quarantine:
    'border-status-info-border bg-status-info-bg text-status-info-fg',
}

const STATUS_SWATCH: Record<RackCellStatus, string> = {
  empty: 'bg-status-neutral-fg',
  occupied: 'bg-status-valid-fg',
  low: 'bg-status-warning-fg',
  expiring: 'bg-status-expiring-fg',
  controlled: 'bg-status-critical-fg',
  critical: 'bg-status-critical-fg',
  quarantine: 'bg-status-info-fg',
}

const LEGEND_ORDER: RackCellStatus[] = [
  'empty',
  'occupied',
  'low',
  'expiring',
  'controlled',
  'critical',
  'quarantine',
]

function cellIndex(row: number, col: number, columns: number): number {
  return row * columns + col
}

function clampFocusable(
  cells: RackCell[],
  start: number,
  delta: number,
): number {
  let i = start
  while (i >= 0 && i < cells.length) {
    if (!cells[i]?.disabled) return i
    i += delta
  }
  return start
}

/**
 * Warehouse rack / bin occupancy map (Stitch shelf-inventory hierarchy visual).
 *
 * Keyboard (RTL-native, logical visual axes):
 * - Grid is `dir="rtl"` so column index 0 sits on the RIGHT.
 * - ArrowLeft → visually left = higher column index.
 * - ArrowRight → visually right = lower column index.
 * - ArrowUp / ArrowDown move by row (same column index).
 * - Home / End jump to first / last focusable cell in the current row.
 * - Enter / Space select the focused cell.
 */
function WarehouseRackGrid({
  columns,
  cells,
  selectedId = null,
  onSelect,
  rowLabels,
  columnLabels,
  legend = false,
  className,
}: WarehouseRackGridProps) {
  const safeColumns = Math.max(1, columns)
  const rows = Math.max(1, Math.ceil(cells.length / safeColumns))

  const firstEnabled = React.useMemo(() => {
    const selectedIdx = selectedId
      ? cells.findIndex((c) => c.id === selectedId && !c.disabled)
      : -1
    if (selectedIdx >= 0) return selectedIdx
    return cells.findIndex((c) => !c.disabled)
  }, [cells, selectedId])

  const [focusedIndex, setFocusedIndex] = React.useState(
    firstEnabled >= 0 ? firstEnabled : 0,
  )
  const cellRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  // Derive a valid focus target without syncing via effect (avoids cascading renders).
  const resolvedFocus =
    cells[focusedIndex] && !cells[focusedIndex]?.disabled
      ? focusedIndex
      : firstEnabled >= 0
        ? firstEnabled
        : 0

  const moveFocus = React.useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= cells.length) return
      if (cells[nextIndex]?.disabled) return
      setFocusedIndex(nextIndex)
      cellRefs.current[nextIndex]?.focus()
    },
    [cells],
  )

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const row = Math.floor(index / safeColumns)
    const col = index % safeColumns
    let next = index

    switch (event.key) {
      case 'ArrowLeft': {
        // Visual left in RTL = higher column index
        event.preventDefault()
        if (col + 1 < safeColumns) {
          next = clampFocusable(
            cells,
            cellIndex(row, col + 1, safeColumns),
            1,
          )
        }
        break
      }
      case 'ArrowRight': {
        // Visual right in RTL = lower column index
        event.preventDefault()
        if (col - 1 >= 0) {
          next = clampFocusable(
            cells,
            cellIndex(row, col - 1, safeColumns),
            -1,
          )
        }
        break
      }
      case 'ArrowUp': {
        event.preventDefault()
        if (row - 1 >= 0) {
          next = clampFocusable(
            cells,
            cellIndex(row - 1, col, safeColumns),
            -safeColumns,
          )
        }
        break
      }
      case 'ArrowDown': {
        event.preventDefault()
        if (row + 1 < rows) {
          next = clampFocusable(
            cells,
            cellIndex(row + 1, col, safeColumns),
            safeColumns,
          )
        }
        break
      }
      case 'Home': {
        event.preventDefault()
        next = clampFocusable(cells, cellIndex(row, 0, safeColumns), 1)
        break
      }
      case 'End': {
        event.preventDefault()
        next = clampFocusable(
          cells,
          cellIndex(row, safeColumns - 1, safeColumns),
          -1,
        )
        break
      }
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const cell = cells[index]
        if (cell && !cell.disabled) onSelect?.(cell.id)
        return
      }
      default:
        return
    }

    if (next !== index) moveFocus(next)
  }

  const defaultColumnLabel = (col: number) =>
    `ستون ${toPersianDigits(col + 1)}`
  const defaultRowLabel = (row: number) => `ردیف ${toPersianDigits(row + 1)}`

  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-slot="warehouse-rack-grid"
        dir="rtl"
        className={cn('flex flex-col gap-space-sm', className)}
      >
        {legend ? (
          <ul
            data-slot="warehouse-rack-grid-legend"
            className="flex flex-wrap items-center gap-space-sm text-label-sm text-text-secondary"
            aria-label="راهنمای وضعیت قفسه"
          >
            {LEGEND_ORDER.map((status) => (
              <li key={status} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    STATUS_SWATCH[status],
                  )}
                  aria-hidden
                />
                <Icon
                  name={STATUS_ICONS[status]}
                  size={14}
                  data-slot="icon"
                />
                <span>{STATUS_LABELS[status]}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="overflow-x-auto">
          <div
            role="grid"
            aria-label="نقشه قفسه انبار"
            aria-colcount={safeColumns}
            aria-rowcount={rows}
            className="inline-grid min-w-full gap-1.5"
          >
            {/* Mobile: wider minmax → fewer columns visible + horizontal scroll; md+: denser cells */}
            <style>{`
              [data-slot="warehouse-rack-grid"] [role="grid"] {
                grid-template-columns: auto repeat(${safeColumns}, minmax(3rem, 1fr));
              }
              @media (min-width: 768px) {
                [data-slot="warehouse-rack-grid"] [role="grid"] {
                  grid-template-columns: auto repeat(${safeColumns}, minmax(2.25rem, 1fr));
                }
              }
            `}</style>

            {/* Header row: corner + ستون / قفسه labels */}
            <div role="row" className="contents">
              <div
                role="columnheader"
                className="flex items-end justify-center px-1 pb-1 text-label-sm text-text-muted"
              >
                قفسه
              </div>
              {Array.from({ length: safeColumns }, (_, col) => (
                <div
                  key={`col-h-${col}`}
                  role="columnheader"
                  className="flex items-end justify-center px-1 pb-1 text-center text-label-sm text-text-secondary tabular-nums-data"
                >
                  {columnLabels?.[col] ?? defaultColumnLabel(col)}
                </div>
              ))}
            </div>

            {Array.from({ length: rows }, (_, row) => (
              <div key={`row-${row}`} role="row" className="contents">
                <div
                  role="rowheader"
                  className="sticky start-0 z-[1] flex items-center justify-end bg-surface pe-2 text-label-sm text-text-secondary tabular-nums-data"
                >
                  {rowLabels?.[row] ?? defaultRowLabel(row)}
                </div>
                {Array.from({ length: safeColumns }, (_, col) => {
                  const index = cellIndex(row, col, safeColumns)
                  const cell = cells[index]
                  if (!cell) {
                    return (
                      <div
                        key={`empty-${row}-${col}`}
                        role="gridcell"
                        aria-disabled="true"
                        className="min-h-10 rounded-inner border border-dashed border-border-default bg-surface-subtle"
                      />
                    )
                  }

                  const isSelected = selectedId === cell.id
                  const isFocused = resolvedFocus === index
                  const accessibleName = cell.title
                    ? `${cell.label}، ${STATUS_LABELS[cell.status]}، ${cell.title}`
                    : `${cell.label}، ${STATUS_LABELS[cell.status]}`

                  const button = (
                    <button
                      ref={(el) => {
                        cellRefs.current[index] = el
                      }}
                      type="button"
                      role="gridcell"
                      data-status={cell.status}
                      aria-selected={isSelected}
                      aria-label={accessibleName}
                      disabled={cell.disabled}
                      tabIndex={isFocused ? 0 : -1}
                      className={cn(
                        'flex min-h-10 w-full flex-col items-center justify-center gap-0.5 rounded-inner border px-1 py-1.5',
                        'text-label-sm transition-[box-shadow,border-color,background-color]',
                        'outline-none focus-visible:shadow-focus focus-visible:ring-2 focus-visible:ring-primary',
                        STATUS_CELL[cell.status],
                        isSelected && 'ring-2 ring-primary ring-offset-1',
                        cell.disabled && 'cursor-not-allowed opacity-50',
                      )}
                      onClick={() => {
                        if (!cell.disabled) onSelect?.(cell.id)
                      }}
                      onKeyDown={(event) => handleKeyDown(event, index)}
                      onFocus={() => setFocusedIndex(index)}
                    >
                      <Icon
                        name={STATUS_ICONS[cell.status]}
                        size={14}
                        data-slot="icon"
                        className="opacity-90"
                      />
                      <span className="max-w-full truncate tabular-nums-data">
                        {cell.label}
                      </span>
                    </button>
                  )

                  if (!cell.title) {
                    return (
                      <React.Fragment key={cell.id}>{button}</React.Fragment>
                    )
                  }

                  return (
                    <Tooltip key={cell.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="top">{cell.title}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export { WarehouseRackGrid }
