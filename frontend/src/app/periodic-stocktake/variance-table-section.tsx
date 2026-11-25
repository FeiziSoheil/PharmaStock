'use client'

import * as React from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  Input,
} from '@/components/ui'
import {
  ActionTooltip,
  DenseDataTable,
  Pagination,
  TriageStatusBadge,
  type DenseColumn,
  type TriageStatus,
} from '@/components/shared'
import { formatPersianNumber, formatRial, toPersianDigits } from '@/lib/persian'
import {
  countFilterBuckets,
  filterStocktakeItems,
} from '@/lib/stocktake/gating'
import type {
  StocktakeCycle,
  StocktakeItem,
  StocktakeVarianceFilter,
} from '@/lib/types/stocktake'
import { cn } from '@/lib/utils'

export type VarianceTableSectionProps = {
  cycle: StocktakeCycle | null
  activeItemId: string | null
  filter: StocktakeVarianceFilter
  onFilterChange: (filter: StocktakeVarianceFilter) => void
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  busyItemId: string | null
  onSelectForCount: (item: StocktakeItem) => void
  onRecountItem: (item: StocktakeItem) => void
  onToggleVerifyItem: (item: StocktakeItem) => void
}

const PAGE_SIZE = 10

function varianceTone(item: StocktakeItem): TriageStatus {
  switch (item.varianceType) {
    case 'shortage':
      return 'critical'
    case 'surplus':
      return 'warning'
    case 'match':
      return 'valid'
    case 'skipped':
      return 'info'
    default:
      return 'neutral'
  }
}

function varianceLabel(item: StocktakeItem): string {
  if (item.countStatus === 'pending') return 'در انتظار شمارش'
  if (item.countStatus === 'skipped') return 'رد شده (نامشخص)'
  const diff = item.varianceQty ?? 0
  if (diff === 0) return '۰ (تطبیق کامل)'
  if (diff < 0) return `${formatPersianNumber(Math.abs(diff))}- (کسری انبار)`
  return `${formatPersianNumber(diff)}+ (مازاد انبار)`
}

function formatSignedRial(value: number | undefined): string {
  if (value === undefined) return '—'
  if (value === 0) return formatRial(0)
  const absFormatted = formatRial(Math.abs(value))
  return value < 0 ? `${absFormatted}-` : `${absFormatted}+`
}

export function VarianceTableSection({
  cycle,
  activeItemId,
  filter,
  onFilterChange,
  searchQuery,
  onSearchQueryChange,
  busyItemId,
  onSelectForCount,
  onRecountItem,
  onToggleVerifyItem,
}: VarianceTableSectionProps) {
  const [page, setPage] = React.useState(1)

  const items = React.useMemo(() => cycle?.items ?? [], [cycle?.items])
  const buckets = React.useMemo(() => countFilterBuckets(items), [items])
  const filtered = React.useMemo(
    () => filterStocktakeItems(items, filter, searchQuery),
    [items, filter, searchQuery],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)

  const handleFilterClick = (nextFilter: StocktakeVarianceFilter) => {
    setPage(1)
    onFilterChange(nextFilter)
  }

  const handleSearchInput = (nextQuery: string) => {
    setPage(1)
    onSearchQueryChange(nextQuery)
  }

  const pageRows = React.useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  const rowIndexById = React.useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((it, idx) => map.set(it.id, idx + 1))
    return map
  }, [filtered])

  const isActiveCycle = cycle?.status === 'active'
  const isBlind = cycle?.method === 'blind' && cycle.status !== 'confirmed'

  const columns: DenseColumn<StocktakeItem>[] = [
    {
      id: 'row',
      header: 'ردیف',
      align: 'start',
      className: 'w-14 text-text-muted',
      cell: (row) => formatPersianNumber(rowIndexById.get(row.id) ?? 0),
    },
    {
      id: 'drug',
      header: 'نام ژنریک دارو و مشخصات فرمولاسیون',
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-text-primary">{row.nameFa}</span>
            {row.id === activeItemId ? (
              <Badge variant="default">در حال شمارش</Badge>
            ) : null}
            {row.isControlled ? (
              <Badge variant="critical">تحت کنترل</Badge>
            ) : null}
          </div>
          <div className="text-label-sm text-text-secondary tabular-nums-data">
            {row.genericCode ? `کد ژنریک: ${row.genericCode}` : ''}
            {row.genericCode && row.manufacturer ? ' • ' : ''}
            {row.manufacturer ?? ''}
          </div>
        </div>
      ),
    },
    {
      id: 'batchNo',
      header: 'سری ساخت (بچ)',
      dir: 'ltr',
      cell: (row) => <span className="font-medium">{row.batchNo}</span>,
    },
    {
      id: 'location',
      header: 'موقعیت قفسه',
      cell: (row) => (
        <span className="text-text-secondary">{row.locationLabel || row.zone}</span>
      ),
    },
    {
      id: 'systemQty',
      header: 'موجودی کاردکس (سیستم)',
      align: 'end',
      cell: (row) =>
        row.systemQty == null && isBlind ? (
          <span className="text-label-sm text-text-muted">محرمانه (کور)</span>
        ) : (
          <span className="font-bold text-text-primary">
            {row.systemQty != null ? formatPersianNumber(row.systemQty) : '—'}
          </span>
        ),
    },
    {
      id: 'physicalQty',
      header: 'شمارش فیزیکی',
      align: 'end',
      cell: (row) => {
        if (row.physicalQty == null) {
          return <span className="text-text-muted">—</span>
        }
        return (
          <span
            className={cn(
              'font-bold',
              row.varianceType === 'shortage' && 'text-status-critical-fg',
              row.varianceType === 'surplus' && 'text-status-warning-fg',
              row.varianceType === 'match' && 'text-status-valid-fg',
            )}
          >
            {formatPersianNumber(row.physicalQty)}
          </span>
        )
      },
    },
    {
      id: 'variance',
      header: 'مغایرت انبار',
      cell: (row) => (
        <TriageStatusBadge status={varianceTone(row)}>
          {varianceLabel(row)}
        </TriageStatusBadge>
      ),
    },
    {
      id: 'varianceRial',
      header: 'ارزش ریالی مغایرت',
      align: 'end',
      cell: (row) => (
        <span
          className={cn(
            'font-semibold',
            row.varianceType === 'shortage' && 'text-status-critical-fg',
            row.varianceType === 'surplus' && 'text-status-valid-fg',
            row.varianceType === 'match' && 'text-text-muted',
          )}
        >
          {formatSignedRial(row.varianceRial)}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'علت مغایرت ارزیابی‌شده',
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-body-sm text-text-secondary">
            {row.varianceReason || '—'}
          </span>
          {row.requiresSupervisor ? (
            <Badge variant={row.supervisorVerified ? 'secondary' : 'critical'}>
              {row.supervisorVerified ? 'تایید ناظر' : 'نیازمند تایید ناظر'}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (row) => {
        const busy = busyItemId === row.id
        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {isActiveCycle ? (
              <ActionTooltip title="شمارش / ویرایش شمارش">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`انتخاب ${row.nameFa} برای شمارش`}
                  disabled={busy}
                  onClick={() => onSelectForCount(row)}
                >
                  <Icon name="edit_note" size={18} data-slot="icon" />
                </Button>
              </ActionTooltip>
            ) : null}
            {isActiveCycle && row.countStatus !== 'pending' ? (
              <ActionTooltip title="درخواست شمارش مجدد">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`شمارش مجدد ${row.nameFa}`}
                  disabled={busy}
                  onClick={() => onRecountItem(row)}
                >
                  <Icon name="replay" size={18} data-slot="icon" />
                </Button>
              </ActionTooltip>
            ) : null}
            {isActiveCycle && row.requiresSupervisor ? (
              <ActionTooltip title="تایید ناظر انبارگردانی">
                <Button
                  type="button"
                  variant={row.supervisorVerified ? 'secondary' : 'outline'}
                  size="sm"
                  disabled={busy}
                  onClick={() => onToggleVerifyItem(row)}
                >
                  <Icon name="verified_user" size={15} data-slot="icon" />
                  {row.supervisorVerified ? 'تایید شد' : 'تایید ناظر'}
                </Button>
              </ActionTooltip>
            ) : null}
          </div>
        )
      },
    },
  ]

  const filterButtons: ReadonlyArray<{
    id: StocktakeVarianceFilter
    label: string
    count: number
    dotClass?: string
  }> = [
    { id: 'all', label: 'همه ردیف‌ها', count: buckets.all },
    {
      id: 'shortage',
      label: 'دارای کسری',
      count: buckets.shortage,
      dotClass: 'bg-status-critical-fg',
    },
    {
      id: 'surplus',
      label: 'دارای مازاد',
      count: buckets.surplus,
      dotClass: 'bg-status-warning-fg',
    },
    {
      id: 'match',
      label: 'تطبیق کامل',
      count: buckets.match,
      dotClass: 'bg-status-valid-fg',
    },
    {
      id: 'uncounted',
      label: 'شمارش‌نشده',
      count: buckets.uncounted,
      dotClass: 'bg-text-muted',
    },
  ]

  return (
    <Card data-slot="stocktake-variance-table-card">
      <CardHeader className="flex flex-col gap-4 border-b border-border-subtle pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon name="difference" size={22} className="text-primary" data-slot="icon" />
            <CardTitle className="text-headline-sm">
              جدول بازبینی و کنترل مغایرت‌ها (سیستم در برابر شمارش فیزیکی)
            </CardTitle>
          </div>
          <p className="text-body-sm text-text-secondary">
            فهرست قلم‌های ثبت‌شده در دوره فعال؛ شناسایی کسری‌های بحرانی و مازادهای انبار پیش از صدور سند نهایی حسابداری انبار.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted"
              data-slot="icon"
            />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="فیلتر دارو، بچ یا قفسه…"
              aria-label="جستجو در جدول مغایرت‌ها"
              className="ps-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="فیلتر مغایرت اقلام"
        >
          {filterButtons.map((btn) => {
            const active = filter === btn.id
            return (
              <Button
                key={btn.id}
                type="button"
                role="tab"
                aria-selected={active}
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => handleFilterClick(btn.id)}
              >
                {btn.dotClass ? (
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      active ? 'bg-primary-foreground' : btn.dotClass,
                    )}
                    aria-hidden
                  />
                ) : null}
                <span>
                  {btn.label} ({toPersianDigits(btn.count)})
                </span>
              </Button>
            )
          })}
        </div>

        <DenseDataTable
          columns={columns}
          data={pageRows}
          getRowId={(row) => row.id}
          stickyHeader
          maxHeight="min(30rem, 58vh)"
          emptyMessage="ردیفی مطابق فیلتر انتخاب‌شده یافت نشد."
          onRowClick={isActiveCycle ? onSelectForCount : undefined}
        />

        <div className="flex flex-col gap-2 rounded-default bg-surface-subtle px-3 py-2 text-label-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="info" size={16} className="text-text-muted" data-slot="icon" />
            کلیه اقلام دارای مغایرت بالای {formatRial(500000)} نیازمند شمارش مضاعف و تایید ناظر مستقل می‌باشند.
          </span>
        </div>

        <Pagination
          page={safePage}
          pageCount={pageCount}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  )
}
