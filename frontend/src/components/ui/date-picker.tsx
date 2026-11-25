'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Icon } from '@/components/ui/icon'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatJalaliDate } from '@/lib/persian'
import { cn } from '@/lib/utils'

export type DatePickerProps = {
  id?: string
  value?: string
  onChange?: (isoDate: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'data-testid'?: string
}

/** Parse `YYYY-MM-DD` as a local calendar date (no UTC shift). */
export function parseIsoDateOnly(iso: string): Date | undefined {
  const trimmed = iso.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }
  return date
}

/** Format a local Date as `YYYY-MM-DD` for API payloads. */
export function toIsoDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * shadcn Calendar + Popover date field.
 * Value/onChange use ISO `YYYY-MM-DD`; the trigger shows Jalali via `formatJalaliDate`.
 */
function DatePicker({
  id,
  value = '',
  onChange,
  disabled = false,
  placeholder = 'انتخاب تاریخ',
  className,
  'aria-invalid': ariaInvalid,
  'data-testid': dataTestId,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? parseIsoDateOnly(value) : undefined
  const invalid = ariaInvalid === true || ariaInvalid === 'true'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-testid={dataTestId}
          aria-invalid={invalid || undefined}
          data-slot="date-picker-trigger"
          className={cn(
            'w-full justify-between font-normal tabular-nums-data',
            !selected && 'text-text-placeholder',
            className,
          )}
        >
          <span className="truncate">
            {selected ? formatJalaliDate(toIsoDateOnly(selected)) : placeholder}
          </span>
          <Icon name="calendar_month" size={18} data-slot="icon" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        data-slot="date-picker-content"
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return
            onChange?.(toIsoDateOnly(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
