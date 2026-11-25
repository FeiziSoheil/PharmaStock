'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type PrintableDocumentLine = {
  id: string
  cells: string[]
}

export type PrintableDocumentPreviewProps = {
  title: string
  subtitle?: string
  documentTitle: string
  meta?: Array<{ label: string; value: string; dir?: 'rtl' | 'ltr' }>
  parties?: Array<{ label: string; value: string }>
  columns: string[]
  lines: PrintableDocumentLine[]
  footerNote?: string
  totalLabel?: string
  totalValue?: string
  /** default true: show print toolbar */
  toolbar?: boolean
  /** default چاپ مستقیم سند */
  printLabel?: string
  onPrint?: () => void
  /** optional extra printable content */
  children?: React.ReactNode
  className?: string
}

const DEFAULT_PRINT_LABEL = 'چاپ مستقیم سند'

/**
 * Presentational printable document shell (RTL Persian / mixed content).
 * Stitch: distributor-returns return-slip preview (~printable-area).
 */
function PrintableDocumentPreview({
  title,
  subtitle,
  documentTitle,
  meta,
  parties,
  columns,
  lines,
  footerNote,
  totalLabel,
  totalValue,
  toolbar = true,
  printLabel = DEFAULT_PRINT_LABEL,
  onPrint,
  children,
  className,
}: PrintableDocumentPreviewProps) {
  const handlePrint = React.useCallback(() => {
    if (onPrint) {
      onPrint()
      return
    }
    window.print()
  }, [onPrint])

  const showTotal = totalLabel != null || totalValue != null
  const colSpan = Math.max(columns.length, 1)

  return (
    <div
      data-slot="printable-document-preview"
      className={cn(
        'flex max-h-[min(942px,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-default border border-border-default bg-surface shadow-none',
        className,
      )}
    >
      {toolbar ? (
        <div
          data-slot="printable-document-toolbar"
          className="print:hidden flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-surface-muted px-4 py-3"
        >
          <div className="flex min-w-0 items-start gap-2">
            <Icon
              name="receipt_long"
              size={24}
              className="mt-0.5 shrink-0 text-primary"
              data-slot="icon"
            />
            <div className="min-w-0">
              <h2 className="text-headline-sm text-text-primary">{title}</h2>
              {subtitle ? (
                <p className="text-label-sm text-text-secondary">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
          >
            <Icon name="print" size={18} data-slot="icon" />
            {printLabel}
          </Button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto bg-surface-muted/40 p-4 sm:p-6 print:bg-white print:p-0">
        <div
          data-slot="printable-area"
          dir="rtl"
          className={cn(
            'mx-auto flex w-full max-w-[210mm] flex-col gap-4',
            'rounded-default border border-border-default bg-white p-4 text-body-md text-text-primary shadow-none sm:p-6',
            'print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none',
          )}
        >
          {/* Document header: pharmacy branding + document title / meta */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-default bg-surface-subtle p-3">
            <div
              data-slot="printable-branding"
              className="flex items-center gap-3"
            >
              <span
                className="inline-flex size-14 shrink-0 items-center justify-center rounded-default bg-primary text-primary-foreground"
                aria-hidden
              >
                <Icon name="local_pharmacy" size={32} data-slot="icon" />
              </span>
              <span className="sr-only">برندینگ داروخانه</span>
            </div>

            <div className="flex flex-col items-end gap-1.5 text-label-md">
              <span className="rounded-default bg-status-critical-bg px-3 py-1 text-headline-sm font-bold text-status-critical-fg">
                {documentTitle}
              </span>
              {meta?.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="flex items-center gap-1.5"
                >
                  <span className="text-text-secondary">{item.label}</span>
                  <strong
                    dir={item.dir}
                    className={cn(
                      'text-text-primary',
                      item.dir === 'ltr' && 'font-latin tabular-nums-data',
                      item.dir !== 'ltr' && 'tabular-nums-data',
                    )}
                  >
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {parties && parties.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 rounded-default bg-surface-muted p-3 text-label-md md:grid-cols-3">
              {parties.map((party) => (
                <div key={`${party.label}-${party.value}`}>
                  <span className="block text-text-secondary">{party.label}</span>
                  <strong className="text-title-md text-text-primary">
                    {party.value}
                  </strong>
                </div>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-default border border-border-default bg-white">
            <table data-slot="table" className="w-full caption-bottom text-body-sm">
              <TableHeader className="static shadow-none">
                <TableRow className="hover:bg-transparent bg-surface-muted">
                  {columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    {line.cells.map((cell, index) => (
                      <TableCell
                        key={`${line.id}-${index}`}
                        className={cn(
                          index === 0 && 'text-center',
                          /[A-Za-z]/.test(cell) && 'font-latin',
                        )}
                        dir={
                          /[A-Za-z0-9]/.test(cell) &&
                          !/[\u0600-\u06FF]/.test(cell)
                            ? 'ltr'
                            : undefined
                        }
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {showTotal ? (
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    {colSpan <= 1 ? (
                      <TableCell className="font-bold text-text-primary">
                        <span>{totalLabel}</span>
                        {totalValue ? (
                          <span className="ms-2 font-latin tabular-nums-data text-primary">
                            {totalValue}
                          </span>
                        ) : null}
                      </TableCell>
                    ) : (
                      <>
                        <TableCell
                          colSpan={colSpan - 1}
                          className="font-bold text-text-primary"
                        >
                          {totalLabel}
                        </TableCell>
                        <TableCell className="text-end font-bold text-primary font-latin tabular-nums-data">
                          {totalValue}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                </TableFooter>
              ) : null}
            </table>
          </div>

          {footerNote ? (
            <p className="text-label-sm text-text-secondary">{footerNote}</p>
          ) : null}

          {children}
        </div>
      </div>
    </div>
  )
}

export { PrintableDocumentPreview }
