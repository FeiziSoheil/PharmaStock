'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type PaginationProps = {
  page: number
  pageCount: number
  totalItems?: number
  pageSize?: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  className?: string
}

/**
 * Dense table footer pagination with RTL-aware chevrons.
 * In RTL, "next" uses chevron_left (visual forward toward the left).
 */
function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50],
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const safePageCount = Math.max(1, pageCount)
  const safePage = Math.min(Math.max(1, page), safePageCount)
  const canPrev = safePage > 1
  const canNext = safePage < safePageCount

  return (
    <nav
      data-slot="pagination"
      aria-label="صفحه‌بندی"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border-default bg-surface px-4 py-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-body-sm text-text-secondary">
        {typeof totalItems === 'number' ? (
          <span data-slot="pagination-summary" className="tabular-nums-data">
            مجموع {totalItems.toLocaleString('fa-IR')} مورد · صفحه{' '}
            {safePage.toLocaleString('fa-IR')} از{' '}
            {safePageCount.toLocaleString('fa-IR')}
          </span>
        ) : (
          <span data-slot="pagination-summary" className="tabular-nums-data">
            صفحه {safePage.toLocaleString('fa-IR')} از{' '}
            {safePageCount.toLocaleString('fa-IR')}
          </span>
        )}
        {onPageSizeChange && typeof pageSize === 'number' ? (
          <div className="flex items-center gap-2">
            <span className="text-label-md">در هر صفحه</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger
                aria-label="تعداد ردیف در هر صفحه"
                className="h-8 w-[4.5rem]"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option.toLocaleString('fa-IR')}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="اولین صفحه"
          disabled={!canPrev}
          onClick={() => onPageChange(1)}
        >
          <Icon name="last_page" size={16} data-slot="icon" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="صفحه قبل"
          disabled={!canPrev}
          onClick={() => onPageChange(safePage - 1)}
        >
          <Icon name="chevron_right" size={16} data-slot="icon" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="صفحه بعد"
          disabled={!canNext}
          onClick={() => onPageChange(safePage + 1)}
        >
          <Icon name="chevron_left" size={16} data-slot="icon" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="آخرین صفحه"
          disabled={!canNext}
          onClick={() => onPageChange(safePageCount)}
        >
          <Icon name="first_page" size={16} data-slot="icon" />
        </Button>
      </div>
    </nav>
  )
}

export { Pagination }
