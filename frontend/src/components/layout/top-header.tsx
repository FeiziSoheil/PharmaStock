'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { IconName } from '@/lib/icons'
import { formatJalaliDate, formatPersianTime } from '@/lib/persian'
import { cn } from '@/lib/utils'
import { NotificationMenu } from './notification-menu'
import { UserMenu } from './user-menu'

export type TopHeaderProps = {
  branchLabel?: string
  showMenuButton?: boolean
  onMenuClick?: () => void
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  onQuickAdd?: () => void
  actions?: React.ReactNode
  className?: string
}

type QuickAddItem = {
  id: string
  label: string
  description: string
  href: string
  icon: IconName
}

const QUICK_ADD_ITEMS: QuickAddItem[] = [
  {
    id: 'new-drug',
    label: 'ثبت داروی جدید',
    description: 'افزودن قلم به کاتالوگ دارو',
    href: '/drug-catalog',
    icon: 'medication',
  },
  {
    id: 'new-receipt',
    label: 'ورود فاکتور و رسید انبار',
    description: 'ثبت ورود کالا و سری ساخت',
    href: '/invoice-receipts',
    icon: 'receipt_long',
  },
  {
    id: 'new-dispense',
    label: 'حواله خروج و فروش',
    description: 'ثبت خروج دارو با اولویت FEFO',
    href: '/dispensing-dispatch',
    icon: 'local_shipping',
  },
  {
    id: 'new-transfer',
    label: 'انتقال داخلی',
    description: 'جابجایی موجودی بین بخش‌ها و قفسه‌ها',
    href: '/internal-transfer',
    icon: 'swap_horiz',
  },
  {
    id: 'new-controlled',
    label: 'ثبت گردش داروی مخدر',
    description: 'ثبت در دفترچه داروهای تحت کنترل',
    href: '/controlled-substances-ledger',
    icon: 'enhanced_encryption',
  },
  {
    id: 'new-stocktake',
    label: 'انبارگردانی دوره‌ای',
    description: 'شروع شمارش و تطبیق موجودی',
    href: '/periodic-stocktake',
    icon: 'fact_check',
  },
]

function QuickAddMenu({ onQuickAdd }: { onQuickAdd?: () => void }) {
  const [open, setOpen] = React.useState(false)

  if (onQuickAdd) {
    return (
      <Button
        type="button"
        variant="default"
        size="icon-lg"
        aria-label="افزودن سریع"
        data-slot="top-header-quick-add"
        onClick={onQuickAdd}
      >
        <Icon name="add" size={20} data-slot="icon" />
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="icon-lg"
          aria-label="افزودن سریع"
          title="افزودن سریع"
          data-slot="top-header-quick-add"
        >
          <Icon name="add" size={20} data-slot="icon" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 p-2"
        data-slot="top-header-quick-add-menu"
      >
        <div className="border-b border-border-subtle px-2.5 pb-2 pt-1">
          <p className="text-label-md font-semibold text-text-primary">افزودن سریع</p>
          <p className="text-label-sm text-text-muted">دسترسی فوری به ثبت عملیات جدید</p>
        </div>
        <nav aria-label="عملیات افزودن سریع" className="mt-1.5 flex flex-col gap-0.5">
          {QUICK_ADD_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-2.5 rounded-default px-2.5 py-2 text-start transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-default bg-primary-tint text-primary">
                <Icon name={item.icon} size={18} data-slot="icon" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-label-md font-medium text-text-primary">
                  {item.label}
                </span>
                <span className="block text-label-sm text-text-muted">
                  {item.description}
                </span>
              </span>
            </Link>
          ))}
        </nav>
      </PopoverContent>
    </Popover>
  )
}

const emptySubscribe = () => () => {}

function HeaderClock() {
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  const [now, setNow] = React.useState<Date>(() => new Date())

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const iso = mounted ? now.toISOString() : ''
  const dateLabel = mounted ? formatJalaliDate(iso) : '—'
  const timeLabel = mounted ? formatPersianTime(iso) : '––:––:––'

  return (
    <time
      data-slot="top-header-clock"
      dateTime={iso || undefined}
      aria-label="ساعت جاری"
      className="hidden h-10 shrink-0 items-center gap-2 rounded-default border border-border-subtle bg-surface-muted px-3 text-text-primary tablet:inline-flex"
    >
      <Icon name="schedule" size={16} className="text-primary" data-slot="icon" />
      <span className="flex flex-col justify-center leading-none">
        <span className="text-[11px] leading-tight text-text-muted tabular-nums-data">{dateLabel}</span>
        <span
          className="font-latin text-body-sm font-semibold leading-tight tabular-nums-data text-text-primary"
          dir="ltr"
        >
          {timeLabel}
        </span>
      </span>
    </time>
  )
}

/**
 * 64px clinical top bar for the floating shell header island:
 * branch picker cue, global search, live clock, actions. Framing (border/radius) is owned by AppShell.
 */
function TopHeader({
  branchLabel = 'شعبه مرکزی',
  showMenuButton = false,
  onMenuClick,
  searchPlaceholder = 'جستجوی دارو، IRC یا سری ساخت…',
  onSearchChange,
  onQuickAdd,
  actions,
  className,
}: TopHeaderProps) {
  return (
    <header
      data-slot="top-header"
      className={cn(
        'flex h-header items-center gap-3 bg-surface px-4',
        className,
      )}
    >
      {showMenuButton ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="باز کردن منو"
          data-slot="top-header-menu"
          onClick={onMenuClick}
        >
          <Icon name="view_list" size={22} data-slot="icon" />
        </Button>
      ) : null}

      <div
        data-slot="top-header-branch"
        className="hidden h-10 items-center gap-2 rounded-default border border-border-default bg-surface px-3 text-body-sm text-text-primary tablet:inline-flex"
      >
        <Icon name="domain" size={18} className="text-primary" data-slot="icon" />
        <span>{branchLabel}</span>
      </div>

      <div className="relative min-w-0 flex-1">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-text-placeholder"
          data-slot="icon"
        />
        <Input
          type="search"
          aria-label="جستجوی سراسری"
          placeholder={searchPlaceholder}
          className="h-10 pe-3 ps-10"
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
      </div>

      <HeaderClock />

      <div
        data-slot="top-header-actions"
        className="flex shrink-0 items-center gap-2 sm:gap-2.5"
      >
        {actions ? <div className="me-1.5 flex items-center">{actions}</div> : null}
        <NotificationMenu className="me-1" />
        <QuickAddMenu onQuickAdd={onQuickAdd} />
        <UserMenu className="ms-2" />
      </div>
    </header>
  )
}

export { TopHeader }
