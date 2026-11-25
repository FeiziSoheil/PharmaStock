'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import {
  ActionTooltip,
  AlertBanner,
  ConfirmDialog,
  DenseDataTable,
  KpiMetricCard,
  PageHeader,
  Pagination,
  SideDrawer,
  TriageStatusBadge,
  type DenseColumn,
} from '@/components/shared'
import {
  EXPIRY_BUCKET_LABELS,
  EXPIRY_BUCKET_TRIAGE,
  daysUntilExpiry,
  getExpiryBucket,
  hasFefoViolation,
  type ExpiryBucket,
} from '@/lib/domain/expiry'
import { DRUG_CATEGORIES, type DrugCategory } from '@/lib/types/drugs'
import {
  type ExpiryBatch,
  type ExpiryBatchStatus,
  type ExpiryKpis,
} from '@/lib/types/expiry'
import {
  fetchExpiryBatches,
  updateExpiryBatchStatus,
} from '@/lib/expiry/data-access'
import { SHELF_ZONES, type ShelfZoneId } from '@/lib/types/shelves'
import {
  remainingDaysLabel,
  type ExpirySortField,
  type ExpiryStageTab,
} from '@/lib/expiry/expiry-query'
import {
  formatJalaliDate,
  formatPersianNumber,
  toPersianDigits,
} from '@/lib/persian'
import { cn } from '@/lib/utils'
import { getExpiryNavItems } from './nav'

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const SEARCH_DEBOUNCE_MS = 300

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type ActiveChip = {
  id: string
  label: string
  clear: () => void
}

type ConfirmAction =
  | 'quarantine'
  | 'quick_sale'
  | 'mark_return'
  | 'relocate'

type ConfirmState = {
  action: ConfirmAction
  batch: ExpiryBatch
}

function sortAria(
  field: ExpirySortField,
  sortBy: ExpirySortField,
  sortDir: 'asc' | 'desc',
): React.AriaAttributes['aria-sort'] {
  if (field !== sortBy) return 'none'
  return sortDir === 'asc' ? 'ascending' : 'descending'
}

function SortableHeader({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string
  field: ExpirySortField
  sortBy: ExpirySortField
  sortDir: 'asc' | 'desc'
  onSort: (field: ExpirySortField) => void
}) {
  const active = sortBy === field
  return (
    <button
      type="button"
      className="ps-focus-ring inline-flex items-center gap-1 text-start"
      onClick={() => onSort(field)}
      aria-label={`مرتب‌سازی بر اساس ${label}`}
    >
      <span>{label}</span>
      <Icon
        name={
          !active ? 'swap_vert' : sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'
        }
        size={14}
        data-slot="icon"
        className={active ? 'text-primary' : 'text-text-muted'}
      />
    </button>
  )
}

function fefoRankTone(bucket: ExpiryBucket | null): string {
  switch (bucket) {
    case 'expired':
      return 'bg-status-critical-fg text-primary-foreground'
    case 'critical':
      return 'bg-status-expiring-fg text-primary-foreground'
    case 'warning':
      return 'bg-status-warning-fg text-primary-foreground'
    case 'watch':
      return 'bg-secondary-tint text-secondary'
    default:
      return 'bg-status-valid-bg text-status-valid-fg'
  }
}

function statusLabel(batch: ExpiryBatch, today: Date): string {
  if (batch.status === 'quarantined') return 'قرنطینه / امحا'
  if (batch.status === 'marked_return') return 'پیگیری مرجوعی'
  if (batch.status === 'quick_sale') return 'فروش سریع'
  if (batch.status === 'relocated') return 'جابجا شده'
  const bucket = getExpiryBucket(batch.expiry, today)
  return bucket ? EXPIRY_BUCKET_LABELS[bucket] : 'نامشخص'
}

function statusTone(
  batch: ExpiryBatch,
  today: Date,
): React.ComponentProps<typeof TriageStatusBadge>['status'] {
  if (batch.status === 'quarantined') return 'critical'
  if (batch.status === 'marked_return') return 'info'
  if (batch.status === 'quick_sale') return 'expiring'
  if (batch.status === 'relocated') return 'neutral'
  const bucket = getExpiryBucket(batch.expiry, today)
  return bucket ? EXPIRY_BUCKET_TRIAGE[bucket] : 'neutral'
}

function confirmCopy(
  state: ConfirmState,
): { title: string; description: string; confirmLabel: string; tone: 'critical' | 'warning' | 'info' } {
  const { action, batch } = state
  const qty = toPersianDigits(batch.quantity)
  const base = `«${batch.nameFa} — سری ساخت ${batch.batchNo}» · تعداد ${qty} ${batch.unitLabel}`

  if (action === 'quarantine') {
    const controlledExtra = batch.isControlled
      ? ' این قلم تحت کنترل است؛ صراحتاً تأیید می‌کنید که انتقال به قرنطینه با نظارت مسئول فنی انجام می‌شود و از چرخه نسخه خارج می‌گردد.'
      : ''
    return {
      title: 'تایید انتقال به انبار قرنطینه و ضایعات',
      description: `آیا از انتقال ${base} به انبار قرنطینه اطمینان دارید؟ پس از تأیید، کالا از سیستم صدور نسخه خارج شده و در کاردکس به‌عنوان ضایعات امحا ثبت می‌شود.${controlledExtra}`,
      confirmLabel: 'تایید و انتقال به قرنطینه',
      tone: 'critical',
    }
  }
  if (action === 'quick_sale') {
    return {
      title: 'تایید اولویت فروش سریع',
      description: `${base} به قفسه/لیست فروش سریع منتقل می‌شود تا پیش از انقضا مصرف شود.`,
      confirmLabel: 'تایید فروش سریع',
      tone: 'warning',
    }
  }
  if (action === 'mark_return') {
    return {
      title: 'تایید اعلام مرجوعی به شرکت پخش',
      description: `${base} برای پیگیری مرجوعی به «${batch.distributor}» علامت‌گذاری می‌شود.`,
      confirmLabel: 'تایید مرجوعی',
      tone: 'warning',
    }
  }
  return {
    title: 'تایید جابجایی قفسه',
    description: `${base} برای جابجایی به موقعیت فروش/اولویت نزدیک‌تر علامت‌گذاری می‌شود (شبیه‌سازی محلی).`,
    confirmLabel: 'تایید جابجایی',
    tone: 'info',
  }
}

function actionToStatus(action: ConfirmAction): ExpiryBatchStatus {
  switch (action) {
    case 'quarantine':
      return 'quarantined'
    case 'quick_sale':
      return 'quick_sale'
    case 'mark_return':
      return 'marked_return'
    case 'relocate':
      return 'relocated'
  }
}

export function ExpiryAlertsView() {
  const today = React.useMemo(() => new Date(), [])
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [bucket, setBucket] = React.useState<ExpiryBucket | ''>('')
  const [category, setCategory] = React.useState<DrugCategory | ''>('')
  const [controlled, setControlled] = React.useState<'all' | 'yes' | 'no'>('all')
  const [zone, setZone] = React.useState<ShelfZoneId | ''>('')
  const [stageTab, setStageTab] = React.useState<ExpiryStageTab>('all_alerts')
  const [sortBy, setSortBy] = React.useState<ExpirySortField>('expiry')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [loadState, setLoadState] = React.useState<LoadState>('loading')
  const [items, setItems] = React.useState<ExpiryBatch[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(1)
  const [kpis, setKpis] = React.useState<ExpiryKpis | null>(null)
  const [bannerDismissed, setBannerDismissed] = React.useState(false)
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null)
  const [confirmLoading, setConfirmLoading] = React.useState(false)
  const originFocusRef = React.useRef<HTMLElement | null>(null)
  const requestIdRef = React.useRef(0)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const queryKey = React.useMemo(
    () =>
      JSON.stringify({
        search,
        bucket,
        category,
        controlled,
        zone,
        stageTab,
        sortBy,
        sortDir,
        page,
        pageSize,
      }),
    [
      search,
      bucket,
      category,
      controlled,
      zone,
      stageTab,
      sortBy,
      sortDir,
      page,
      pageSize,
    ],
  )

  const load = React.useCallback(async () => {
    const requestId = ++requestIdRef.current
    try {
      const result = await fetchExpiryBatches({
        search,
        bucket,
        category,
        zone,
        isControlled:
          controlled === 'all' ? null : controlled === 'yes' ? true : false,
        stageTab,
        sortBy,
        sortDir,
        page,
        pageSize,
      })
      if (requestId !== requestIdRef.current) return
      setItems(result.items)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setPage(result.page)
      setKpis(result.kpis)
      setLoadState('ready')
    } catch {
      if (requestId !== requestIdRef.current) return
      setLoadState('error')
    }
  }, [
    search,
    bucket,
    category,
    controlled,
    zone,
    stageTab,
    sortBy,
    sortDir,
    page,
    pageSize,
  ])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoadState('loading')
      await load()
    })()
    return () => {
      cancelled = true
    }
  }, [queryKey, load])

  function clearAllFilters() {
    setSearchInput('')
    setSearch('')
    setBucket('')
    setCategory('')
    setControlled('all')
    setZone('')
    setStageTab('all_alerts')
    setPage(1)
  }

  function handleSort(field: ExpirySortField) {
    if (sortBy === field) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(field === 'expiry' ? 'asc' : 'asc')
    }
    setPage(1)
  }

  function applyKpiFilter(next: ExpiryBucket) {
    setBucket(next)
    // Align stage chip with KPI when Stitch has a matching tab; otherwise keep
    // "all alerts" only for alert buckets (ok/watch are KPI-only filters).
    if (next === 'expired') setStageTab('expired')
    else if (next === 'critical') setStageTab('critical')
    else if (next === 'warning') setStageTab('warning')
    else setStageTab('all_alerts')
    setPage(1)
  }

  function openConfirm(
    action: ConfirmAction,
    batch: ExpiryBatch,
    origin?: HTMLElement | null,
  ) {
    originFocusRef.current =
      origin ?? (document.activeElement as HTMLElement | null)
    setConfirm({ action, batch })
  }

  function handleConfirmOpenChange(open: boolean) {
    if (!open) {
      setConfirm(null)
      setConfirmLoading(false)
      window.setTimeout(() => {
        originFocusRef.current?.focus?.()
        originFocusRef.current = null
      }, 0)
    }
  }

  async function handleConfirmAction() {
    if (!confirm) return
    setConfirmLoading(true)
    const nextStatus = actionToStatus(confirm.action)
    try {
      const updated = await updateExpiryBatchStatus(
        confirm.batch.batchId,
        nextStatus,
      )
      setConfirmLoading(false)
      setConfirm(null)
      window.setTimeout(() => {
        originFocusRef.current?.focus?.()
        originFocusRef.current = null
      }, 0)
      if (!updated) {
        toast.error('به‌روزرسانی وضعیت انجام نشد.')
        return
      }
      toast.success(
        confirm.action === 'quarantine'
          ? 'انتقال به قرنطینه ثبت شد.'
          : confirm.action === 'quick_sale'
            ? 'اولویت فروش سریع ثبت شد.'
            : confirm.action === 'mark_return'
              ? 'مرجوعی برای پیگیری علامت‌گذاری شد.'
              : 'جابجایی قفسه ثبت شد.',
      )
      setLoadState('loading')
      await load()
    } catch (err) {
      setConfirmLoading(false)
      toast.error(
        err instanceof Error ? err.message : 'به‌روزرسانی وضعیت انجام نشد.',
      )
    }
  }

  const chips: ActiveChip[] = []
  if (search) {
    chips.push({
      id: 'search',
      label: `جستجو: ${search}`,
      clear: () => {
        setSearchInput('')
        setSearch('')
        setPage(1)
      },
    })
  }
  if (bucket) {
    chips.push({
      id: 'bucket',
      label: `باکت: ${EXPIRY_BUCKET_LABELS[bucket]}`,
      clear: () => {
        setBucket('')
        setPage(1)
      },
    })
  }
  if (category) {
    chips.push({
      id: 'category',
      label: `رده: ${category}`,
      clear: () => {
        setCategory('')
        setPage(1)
      },
    })
  }
  if (controlled !== 'all') {
    chips.push({
      id: 'controlled',
      label: controlled === 'yes' ? 'تحت کنترل' : 'غیرکنترلی',
      clear: () => {
        setControlled('all')
        setPage(1)
      },
    })
  }
  if (zone) {
    const zoneMeta = SHELF_ZONES.find((z) => z.id === zone)
    chips.push({
      id: 'zone',
      label: `ناحیه: ${zoneMeta?.label ?? zone}`,
      clear: () => {
        setZone('')
        setPage(1)
      },
    })
  }
  if (stageTab !== 'all_alerts') {
    const tabLabels: Record<ExpiryStageTab, string> = {
      all_alerts: 'تمام هشدارهای فعال',
      expired: 'منقضی شده و قرنطینه',
      critical: 'کمتر از ۱ ماه',
      warning: '۱ تا ۳ ماه',
      marked_return: 'پیگیری مرجوعی شرکت‌ها',
    }
    chips.push({
      id: 'stage',
      label: `مرحله: ${tabLabels[stageTab]}`,
      clear: () => {
        setStageTab('all_alerts')
        setPage(1)
      },
    })
  }

  const fefoBroken = hasFefoViolation(
    items.map((row) => ({
      drugId: row.drugId,
      batchId: row.batchId,
      expiryISO: row.expiry,
    })),
  )

  const expiredCount = kpis?.expired ?? 0
  const criticalCount = kpis?.critical ?? 0
  const showBanner =
    !bannerDismissed && loadState === 'ready' && (expiredCount > 0 || criticalCount > 0)

  const emptyNoAlerts =
    loadState === 'ready' &&
    total === 0 &&
    !search &&
    !bucket &&
    !category &&
    controlled === 'all' &&
    !zone &&
    stageTab === 'all_alerts'

  const emptyNoMatch = loadState === 'ready' && total === 0 && !emptyNoAlerts

  const stageTabs: { id: ExpiryStageTab; label: string; count: number; tone?: string }[] =
    [
      {
        id: 'all_alerts',
        label: 'تمام هشدارهای فعال',
        count: kpis?.allAlerts ?? 0,
        tone: 'bg-primary text-primary-foreground',
      },
      {
        id: 'expired',
        label: 'منقضی شده و قرنطینه',
        count: kpis?.expired ?? 0,
        tone: 'bg-status-critical-fg text-primary-foreground',
      },
      {
        id: 'critical',
        label: 'کمتر از ۱ ماه',
        count: kpis?.critical ?? 0,
        tone: 'bg-status-expiring-bg text-status-expiring-fg',
      },
      {
        id: 'warning',
        label: '۱ تا ۳ ماه',
        count: kpis?.warning ?? 0,
        tone: 'bg-surface-muted text-text-secondary',
      },
      {
        id: 'marked_return',
        label: 'پیگیری مرجوعی شرکت‌ها',
        count: kpis?.markedReturn ?? 0,
                tone: 'bg-secondary text-primary-foreground',
      },
    ]

  const columns: DenseColumn<ExpiryBatch>[] = [
    {
      id: 'rank',
      header: 'رتبه FEFO',
      headerClassName: 'w-16 text-center',
      className: 'w-16 text-center',
      cell: (row) => {
        const globalIndex =
          (page - 1) * pageSize + items.findIndex((item) => item.batchId === row.batchId)
        const rank = globalIndex + 1
        const rowBucket = getExpiryBucket(row.expiry, today)
        return (
          <span
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-full text-label-md font-bold tabular-nums-data',
              fefoRankTone(rowBucket),
            )}
          >
            {toPersianDigits(rank)}
          </span>
        )
      },
    },
    {
      id: 'nameFa',
      ariaSort: sortAria('nameFa', sortBy, sortDir),
      header: (
        <SortableHeader
          label="نام دارو و مشخصات بالینی"
          field="nameFa"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => {
        const rowBucket = getExpiryBucket(row.expiry, today)
        return (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-inner bg-surface-subtle',
                rowBucket === 'expired'
                  ? 'text-status-critical-fg'
                  : 'text-primary',
              )}
            >
              <Icon
                name={row.isControlled ? 'lock' : 'medication'}
                size={22}
                data-slot="icon"
              />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'text-label-lg font-bold',
                    rowBucket === 'expired'
                      ? 'text-status-critical-fg'
                      : 'text-text-primary',
                  )}
                >
                  {row.nameFa}
                </span>
                {rowBucket === 'expired' ? (
                  <Badge variant="critical" className="rounded-inner text-[11px]">
                    منقضی!
                  </Badge>
                ) : null}
                {row.isControlled ? (
                  <Badge variant="warning" className="rounded-inner text-[11px]">
                    تحت کنترل
                  </Badge>
                ) : null}
              </div>
              <p className="text-body-sm text-text-secondary" dir="ltr">
                <span className="font-latin">{row.nameEn}</span>
                <span aria-hidden> | </span>
                <span>{row.manufacturer}</span>
              </p>
            </div>
          </div>
        )
      },
    },
    {
      id: 'distributor',
      ariaSort: sortAria('distributor', sortBy, sortDir),
      header: (
        <SortableHeader
          label="شرکت توزیع‌کننده"
          field="distributor"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      cell: (row) => (
        <div>
          <div className="text-label-md text-text-primary">{row.distributor}</div>
          <div className="text-body-sm text-text-secondary">
            فاکتور: {toPersianDigits(row.invoiceNo)}
          </div>
        </div>
      ),
    },
    {
      id: 'batchNo',
      ariaSort: sortAria('batchNo', sortBy, sortDir),
      header: (
        <SortableHeader
          label="سری ساخت (Batch)"
          field="batchNo"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      dir: 'ltr',
      cell: (row) => (
        <span className="rounded-inner bg-surface-subtle px-2 py-0.5 font-latin text-label-md font-bold tabular-nums-data">
          {row.batchNo}
        </span>
      ),
    },
    {
      id: 'expiry',
      ariaSort: sortAria('expiry', sortBy, sortDir),
      header: (
        <SortableHeader
          label="تاریخ انقضا و زمان مانده"
          field="expiry"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => {
        const days = daysUntilExpiry(row.expiry, today)
        const rowBucket = getExpiryBucket(row.expiry, today)
        const tone =
          rowBucket === 'expired' || rowBucket === 'critical'
            ? 'text-status-critical-fg'
            : rowBucket === 'warning'
              ? 'text-status-warning-fg'
              : 'text-text-primary'
        return (
          <div>
            <div className={cn('font-bold tabular-nums-data', tone)}>
              {formatJalaliDate(row.expiry)}
            </div>
            {days !== null ? (
              <div
                className={cn(
                  'mt-0.5 flex items-center gap-1 text-label-sm font-semibold',
                  tone,
                )}
              >
                <Icon
                  name={days < 0 ? 'warning' : 'alarm'}
                  size={13}
                  data-slot="icon"
                />
                <span className="tabular-nums-data">
                  {toPersianDigits(remainingDaysLabel(days))}
                </span>
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      id: 'quantity',
      ariaSort: sortAria('quantity', sortBy, sortDir),
      header: (
        <SortableHeader
          label="موجودی انبار"
          field="quantity"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      align: 'end',
      cell: (row) => (
        <div className="text-end">
          <span className="text-[15px] font-bold tabular-nums-data text-text-primary">
            {formatPersianNumber(row.quantity)}
          </span>{' '}
          <span className="text-body-sm text-text-secondary">{row.unitLabel}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت انقضا',
      cell: (row) => (
        <TriageStatusBadge status={statusTone(row, today)}>
          {statusLabel(row, today)}
        </TriageStatusBadge>
      ),
    },
    {
      id: 'location',
      header: 'موقعیت و شرایط نگهداری',
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      cell: (row) => (
        <div>
          <div className="flex items-center gap-1 text-label-md text-text-primary">
            <Icon name="shelves" size={16} className="text-text-muted" data-slot="icon" />
            {row.locationLabel}
          </div>
          <div className="text-body-sm text-text-secondary">{row.storageNote}</div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'اقدامات اضطراری',
      headerClassName: 'w-48 text-center',
      className: 'w-48',
      cell: (row) => {
        const rowBucket = getExpiryBucket(row.expiry, today)
        if (row.status === 'quarantined') {
          return (
            <span className="text-label-sm text-text-secondary">در قرنطینه</span>
          )
        }
        if (rowBucket === 'expired') {
          return (
            <ActionTooltip title="انتقال به قرنطینه">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={(event) =>
                  openConfirm('quarantine', row, event.currentTarget)
                }
              >
                <Icon name="delete_sweep" size={16} data-slot="icon" />
                انتقال به قرنطینه
              </Button>
            </ActionTooltip>
          )
        }
        if (rowBucket === 'critical') {
          return (
            <div className="flex items-center gap-1">
              <ActionTooltip title="فروش سریع (FEFO)">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 border-status-expiring-border bg-status-expiring-bg text-status-expiring-fg"
                  onClick={(event) =>
                    openConfirm('quick_sale', row, event.currentTarget)
                  }
                >
                  <Icon name="bolt" size={14} data-slot="icon" />
                  فروش سریع
                </Button>
              </ActionTooltip>
              <ActionTooltip title="استرداد به شرکت پخش">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="استرداد به شرکت"
                  onClick={(event) =>
                    openConfirm('mark_return', row, event.currentTarget)
                  }
                >
                  <Icon name="reply" size={16} data-slot="icon" />
                </Button>
              </ActionTooltip>
            </div>
          )
        }
        if (rowBucket === 'warning') {
          return (
            <div className="flex items-center gap-1">
              <ActionTooltip title="جابجایی قفسه (FEFO)">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(event) =>
                    openConfirm('relocate', row, event.currentTarget)
                  }
                >
                  <Icon name="move_up" size={14} data-slot="icon" />
                  جابجایی قفسه
                </Button>
              </ActionTooltip>
              <ActionTooltip title="استرداد به شرکت پخش">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="استرداد به شرکت"
                  onClick={(event) =>
                    openConfirm('mark_return', row, event.currentTarget)
                  }
                >
                  <Icon name="reply" size={16} data-slot="icon" />
                </Button>
              </ActionTooltip>
            </div>
          )
        }
        return (
          <Link
            href="#"
            title="مسیر کاردکس هنوز پیاده‌سازی نشده"
            className="ps-focus-ring inline-flex h-8 w-full items-center justify-center gap-1 rounded-default border border-border-default bg-surface-muted px-2 text-label-sm text-text-primary transition-colors hover:bg-surface-hover"
          >
            <Icon name="visibility" size={16} data-slot="icon" />
            مشاهده کاردکس
          </Link>
        )
      },
    },
  ]

  const confirmMeta = confirm ? confirmCopy(confirm) : null

  return (
    <AppShell
      navItems={getExpiryNavItems('alerts')}
      sidebar={{
        brand: {
          title: 'انبار دارو',
          subtitle: 'سامانه جامع موجودی داروخانه',
        },
      }}
      header={{
        branchLabel: 'داروخانه دکتر حسینی (مرکزی)',
        searchPlaceholder: 'جستجوی نام دارو، کد ژنریک، بارکد یا شناسه IRC...',
      }}
      contentClassName="space-y-4"
    >
      <PageHeader
          title="پایش تاریخ انقضا و مدیریت سری ساخت (FEFO)"
          description="سیستم هوشمند پیشگیری از انقضای دارو بر اساس خروج به ترتیب اولویت تاریخ (First Expiry, First Out)"
          breadcrumbs={
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">مدیریت داروخانه</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">کنترل کیفیت و ایمنی</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    مدیریت تاریخ انقضا و هشدارهای دارویی
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
          actions={
            <>
              <Badge
                variant="secondary"
                className="hidden items-center gap-1.5 sm:inline-flex"
              >
                <span
                  className="size-1.5 animate-pulse rounded-full bg-primary"
                  aria-hidden
                />
                نظارت بلادرنگ کاردکس
              </Badge>
              <Button type="button" variant="outline" onClick={() => toast.info('خروجی PDF شبیه‌سازی شد.')}>
                <Icon name="picture_as_pdf" size={18} data-slot="icon" />
                خروجی PDF صورت‌جلسه انقضا
              </Button>
              <Button
                type="button"
                onClick={() => toast.info('صدور لیست مرجوعی شبیه‌سازی شد.')}
              >
                <Icon name="assignment_return" size={18} data-slot="icon" />
                صدور لیست مرجوعی به شرکت‌های پخش
              </Button>
            </>
          }
        />

        {showBanner ? (
          <AlertBanner
            tone="critical"
            title={`هشدار انقضا: ${formatPersianNumber(expiredCount)} سری منقضی و ${formatPersianNumber(criticalCount)} سری بحرانی`}
            description="اقلام منقضی و نزدیک‌به‌انقضا نیاز به اقدام فوری دارند. فیلتر باکت‌ها را از کارت‌های KPI اعمال کنید."
            onDismiss={() => setBannerDismissed(true)}
          />
        ) : null}

        {fefoBroken ? (
          <AlertBanner
            tone="warning"
            title="نقض ترتیب FEFO در فهرست فعلی"
            description="در ترتیب نمایش فعلی، سری ساخت جدیدتر یک دارو قبل از سری قدیمی‌تر آمده است. مرتب‌سازی پیش‌فرض انقضا (صعودی) را اعمال کنید."
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSortBy('expiry')
                  setSortDir('asc')
                  setPage(1)
                }}
              >
                مرتب‌سازی FEFO
              </Button>
            }
          />
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            className="ps-focus-ring rounded-default text-start"
            onClick={() => applyKpiFilter('expired')}
            aria-pressed={bucket === 'expired'}
          >
            <KpiMetricCard
              title="بحرانی (منقضی شده - امحا)"
              value={formatPersianNumber(kpis?.expired ?? 0)}
              description="سری ساخت در انبار"
              icon="delete_forever"
              tone="critical"
              delta={{ label: 'ارزش بلوکه / امحا', direction: 'flat' }}
              className={cn(bucket === 'expired' && 'ring-2 ring-status-critical-fg')}
            />
          </button>
          <button
            type="button"
            className="ps-focus-ring rounded-default text-start"
            onClick={() => applyKpiFilter('critical')}
            aria-pressed={bucket === 'critical'}
          >
            <KpiMetricCard
              title="فوری (کمتر از ۳۰ روز)"
              value={formatPersianNumber(kpis?.critical ?? 0)}
              description="قلم دارویی فعال"
              icon="emergency"
              tone="expiring"
              delta={{ label: 'اولویت فوری در فروش', direction: 'up' }}
              className={cn(bucket === 'critical' && 'ring-2 ring-status-expiring-fg')}
            />
          </button>
          <button
            type="button"
            className="ps-focus-ring rounded-default text-start"
            onClick={() => applyKpiFilter('warning')}
            aria-pressed={bucket === 'warning'}
          >
            <KpiMetricCard
              title="هشدار (۳۰ تا ۹۰ روز)"
              value={formatPersianNumber(kpis?.warning ?? 0)}
              description="قلم در معرض خطر"
              icon="calendar_clock"
              tone="warning"
              delta={{ label: 'پیشنهاد تخفیف یا انتقال', direction: 'flat' }}
              className={cn(bucket === 'warning' && 'ring-2 ring-status-warning-fg')}
            />
          </button>
          <button
            type="button"
            className="ps-focus-ring rounded-default text-start"
            onClick={() => applyKpiFilter('ok')}
            aria-pressed={bucket === 'ok'}
          >
            <KpiMetricCard
              title="وضعیت ایمن (بیش از ۶ ماه)"
              value={formatPersianNumber(kpis?.ok ?? 0)}
              description="ردیف بدون ریسک"
              icon="verified"
              tone="valid"
              delta={{
                label: `پیگیری میان‌مدت: ${formatPersianNumber(kpis?.watch ?? 0)}`,
                direction: 'flat',
              }}
              className={cn(bucket === 'ok' && 'ring-2 ring-status-valid-fg')}
            />
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-default border border-border-default bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex w-full gap-1 overflow-x-auto rounded-inner bg-surface-muted p-1 lg:w-auto"
            role="tablist"
            aria-label="مراحل هشدار انقضا"
          >
            {stageTabs.map((tab) => {
              const active = stageTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    'ps-focus-ring flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 py-1.5 text-label-md transition-colors',
                    active
                      ? 'border border-border-default bg-surface font-semibold text-primary shadow-none'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                  onClick={() => {
                    setStageTab(tab.id)
                    if (tab.id === 'expired') setBucket('expired')
                    else if (tab.id === 'critical') setBucket('critical')
                    else if (tab.id === 'warning') setBucket('warning')
                    else setBucket('')
                    setPage(1)
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'inline-flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums-data',
                      active ? 'bg-primary text-primary-foreground' : tab.tone,
                    )}
                  >
                    {formatPersianNumber(tab.count)}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
            <div className="relative min-w-[12rem] flex-1 sm:w-64 sm:flex-none">
              <Icon
                name="filter_alt"
                size={18}
                className="pointer-events-none absolute end-2.5 top-2.5 text-text-muted"
                data-slot="icon"
              />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="فیلتر بر اساس نام دارو، بچ..."
                aria-label="جستجوی نام دارو یا سری ساخت"
                className="pe-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFilterDrawerOpen(true)}
            >
              <Icon name="tune" size={18} data-slot="icon" />
              فیلتر پیشرفته
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => toast.info('خروجی اکسل شبیه‌سازی شد.')}
            >
              <Icon name="download" size={18} data-slot="icon" />
              اکسل
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chips.length === 0 ? (
            <span className="text-label-sm text-text-muted">بدون فیلتر</span>
          ) : (
            chips.map((chip) => (
              <Badge
                key={chip.id}
                variant="outline"
                className="gap-1 rounded-full pe-1"
              >
                {chip.label}
                <button
                  type="button"
                  className="ps-focus-ring rounded-full p-0.5 hover:bg-surface-muted"
                  aria-label={`حذف فیلتر ${chip.label}`}
                  onClick={chip.clear}
                >
                  <Icon name="close" size={14} data-slot="icon" />
                </button>
              </Badge>
            ))
          )}
          {chips.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
            >
              پاکسازی همه فیلترها
            </Button>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-default border border-border-default bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-muted px-4 py-2 text-label-sm text-text-secondary">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                <Icon name="swap_vert" size={16} data-slot="icon" />
                مرتب‌سازی هوشمند: نزدیک‌ترین انقضا به دورترین (قانون FEFO)
              </span>
              <span className="size-1.5 rounded-full bg-border-default" aria-hidden />
              <span className="tabular-nums-data">
                نمایش{' '}
                {total === 0
                  ? toPersianDigits('0')
                  : toPersianDigits(`${(page - 1) * pageSize + 1}`)}{' '}
                تا{' '}
                {toPersianDigits(String(Math.min(page * pageSize, total)))} از{' '}
                {formatPersianNumber(total)} هشدار
              </span>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-primary"
              onClick={() => toast.info('چاپ برچسب قفسه شبیه‌سازی شد.')}
            >
              <Icon name="print" size={16} data-slot="icon" />
              چاپ برچسب‌های قفسه
            </button>
          </div>

          {loadState === 'loading' ? (
            <div
              data-slot="expiry-alerts-skeleton"
              className="space-y-3 p-4"
              aria-busy="true"
              aria-label="در حال بارگذاری"
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-inner bg-surface-muted"
                />
              ))}
            </div>
          ) : null}

          {loadState === 'error' ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <Icon name="error" size={32} className="text-status-critical-fg" />
              <p className="text-title-sm text-text-primary">خطا در بارگذاری هشدارها</p>
              <p className="text-body-sm text-text-secondary">
                لطفاً دوباره تلاش کنید.
              </p>
              <Button
                type="button"
                onClick={() => {
                  setLoadState('loading')
                  void load()
                }}
              >
                تلاش مجدد
              </Button>
            </div>
          ) : null}

          {emptyNoAlerts ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Icon name="verified" size={36} className="text-status-valid-fg" />
              <p className="text-title-sm">هشدار انقضای فعالی وجود ندارد</p>
              <p className="text-body-sm text-text-secondary">
                همه سری‌ساخت‌ها در وضعیت ایمن هستند.
              </p>
            </div>
          ) : null}

          {emptyNoMatch ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Icon name="search" size={36} className="text-text-muted" />
              <p className="text-title-sm">نتیجه‌ای با این فیلترها یافت نشد</p>
              <Button type="button" variant="outline" onClick={clearAllFilters}>
                پاکسازی فیلترها
              </Button>
            </div>
          ) : null}

          {loadState === 'ready' && total > 0 ? (
            <>
              <DenseDataTable
                columns={columns}
                data={items}
                getRowId={(row) => row.batchId}
                stickyHeader
                maxHeight="min(32rem, 60vh)"
                emptyMessage="موردی برای نمایش وجود ندارد"
              />
              <Pagination
                page={page}
                pageCount={pageCount}
                totalItems={total}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card className="gap-3 p-4">
            <div className="flex items-center gap-2 text-title-md font-bold text-primary">
              <Icon name="verified_user" size={20} data-slot="icon" />
              دستورالعمل خروج بر اساس انقضا (FEFO)
            </div>
            <CardContent className="p-0 text-body-sm text-text-secondary">
              طبق آیین‌نامه سازمان غذا و دارو، داروها با تاریخ انقضای نزدیک‌تر همواره باید
              در اولویت عرضه قرار گیرند حتی اگر تاریخ تحویل فاکتور آن‌ها متاخرتر باشد.
            </CardContent>
            <div className="mt-auto flex items-center justify-between rounded-inner bg-surface-muted px-2 py-1.5 text-label-sm text-text-secondary">
              <span>شاخص انطباق قفسه‌ها:</span>
              <span className="font-bold text-primary tabular-nums-data">
                {toPersianDigits('۹۹.۴٪')} استاندارد
              </span>
            </div>
          </Card>
          <Card className="gap-3 p-4">
            <div className="flex items-center gap-2 text-title-md font-bold text-status-expiring-fg">
              <Icon name="assignment_late" size={20} data-slot="icon" />
              مهلت مرجوعی به شرکت‌های پخش
            </div>
            <CardContent className="p-0 text-body-sm text-text-secondary">
              داروهای با تاریخ انقضای کمتر از ۳ ماه باید حداقل ۹۰ روز پیش از موعد به شرکت
              مربوطه اعلام شوند تا واجد شرایط استرداد وجه گردند.
            </CardContent>
            <div className="mt-auto flex items-center justify-between rounded-inner bg-status-expiring-bg px-2 py-1.5 text-label-sm text-status-expiring-fg">
              <span>فاکتورهای نیازمند پیگیری:</span>
              <span className="font-bold tabular-nums-data">
                {formatPersianNumber(kpis?.markedReturn ?? 0)} مورد باز
              </span>
            </div>
          </Card>
          <Card className="gap-3 p-4">
            <div className="flex items-center gap-2 text-title-md font-bold text-secondary">
              <Icon name="thermostat" size={20} data-slot="icon" />
              پایش هوشمند سنسورهای دمایی انبار
            </div>
            <CardContent className="p-0 text-body-sm text-text-secondary">
              سنسورهای بی‌سیم یخچال و محیط در وضعیت پایدار هستند. انحراف دمایی به‌صورت
              خودکار ماندگاری بیولوژیکی را بازمحاسبه می‌کند.
            </CardContent>
            <div className="mt-auto flex items-center justify-between rounded-inner bg-secondary-tint/40 px-2 py-1.5 text-label-sm text-secondary">
              <span>دمای متوسط یخچال مرکزی:</span>
              <span className="font-bold text-primary tabular-nums-data" dir="ltr">
                +{toPersianDigits('4.2')}°C (نرمال)
              </span>
            </div>
          </Card>
        </div>

      <SideDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        title="فیلتر پیشرفته هشدار انقضا"
        description="رده درمانی، ناحیه نگهداری و پرچم تحت‌کنترل"
      >
        <div className="flex flex-col gap-4 p-1">
          <div className="space-y-2">
            <Label htmlFor="expiry-category">رده درمانی</Label>
            <Select
              value={category || '__all__'}
              onValueChange={(value) => {
                setCategory(value === '__all__' ? '' : (value as DrugCategory))
                setPage(1)
              }}
            >
              <SelectTrigger id="expiry-category" aria-label="رده درمانی">
                <SelectValue placeholder="همه رده‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="__all__">همه رده‌ها</SelectItem>
                  {DRUG_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry-zone">ناحیه / منطقه</Label>
            <Select
              value={zone || '__all__'}
              onValueChange={(value) => {
                setZone(value === '__all__' ? '' : (value as ShelfZoneId))
                setPage(1)
              }}
            >
              <SelectTrigger id="expiry-zone" aria-label="ناحیه نگهداری">
                <SelectValue placeholder="همه نواحی" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="__all__">همه نواحی</SelectItem>
                  {SHELF_ZONES.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry-controlled">پرچم تحت کنترل</Label>
            <Select
              value={controlled}
              onValueChange={(value) => {
                setControlled(value as 'all' | 'yes' | 'no')
                setPage(1)
              }}
            >
              <SelectTrigger id="expiry-controlled" aria-label="تحت کنترل">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="yes">فقط تحت کنترل</SelectItem>
                  <SelectItem value="no">غیرکنترلی</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry-bucket">باکت انقضا</Label>
            <Select
              value={bucket || '__all__'}
              onValueChange={(value) => {
                setBucket(value === '__all__' ? '' : (value as ExpiryBucket))
                setPage(1)
              }}
            >
              <SelectTrigger id="expiry-bucket" aria-label="باکت انقضا">
                <SelectValue placeholder="همه باکت‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="__all__">همه باکت‌ها</SelectItem>
                  {(Object.keys(EXPIRY_BUCKET_LABELS) as ExpiryBucket[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {EXPIRY_BUCKET_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="mt-2"
            onClick={() => setFilterDrawerOpen(false)}
          >
            اعمال فیلترها
          </Button>
        </div>
      </SideDrawer>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={handleConfirmOpenChange}
        title={confirmMeta?.title ?? ''}
        description={confirmMeta?.description}
        tone={confirmMeta?.tone ?? 'warning'}
        confirmLabel={confirmMeta?.confirmLabel}
        cancelLabel="انصراف"
        loading={confirmLoading}
        onConfirm={() => {
          void handleConfirmAction()
        }}
      />
    </AppShell>
  )
}
