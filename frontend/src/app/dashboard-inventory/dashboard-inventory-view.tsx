'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
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
  Pagination,
  TriageStatusBadge,
  type DenseColumn,
} from '@/components/shared'
import { DRUG_CATEGORIES } from '@/lib/types/drugs'
import type { ExpiryBatchStatus } from '@/lib/types/expiry'
import {
  bulkUpdateInventoryStatus,
  downloadInventoryExcelCsv,
  fetchInventoryDashboard,
  updateSingleBatchStatus,
} from '@/lib/inventory/data-access'
import {
  formatTodayJalaliBanner,
  INVENTORY_STATUS_META,
  remainingDaysText,
  stockCoverageRatio,
  STORAGE_TEMP_LABELS,
} from '@/lib/inventory/helpers'
import type {
  InventoryKpis,
  InventoryRow,
  InventorySortField,
  InventoryStatus,
} from '@/lib/inventory/types'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'
import { cn } from '@/lib/utils'
import { getInventoryDashboardNavItems } from './nav'
import { StockInDrawer } from './stock-in-drawer'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const SEARCH_DEBOUNCE_MS = 300

type LoadState = 'loading' | 'ready' | 'error'

type ToggleableColumnId = 'irc' | 'batchNo' | 'location' | 'actions'

type PendingAction =
  | { kind: 'single'; batchId: string; status: ExpiryBatchStatus; label: string }
  | { kind: 'bulk'; batchIds: string[]; status: ExpiryBatchStatus; label: string }

function sortAria(
  field: InventorySortField,
  sortBy: InventorySortField,
  sortDir: 'asc' | 'desc',
): React.AriaAttributes['aria-sort'] {
  if (sortBy !== field) return 'none'
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
  field: InventorySortField
  sortBy: InventorySortField
  sortDir: 'asc' | 'desc'
  onSort: (field: InventorySortField) => void
}) {
  const active = sortBy === field
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-start text-label-md font-medium text-text-secondary hover:text-text-primary"
      onClick={() => onSort(field)}
    >
      <span>{label}</span>
      <Icon
        name={
          active
            ? sortDir === 'asc'
              ? 'arrow_upward'
              : 'arrow_downward'
            : 'unfold_more'
        }
        size={14}
        data-slot="icon"
      />
    </button>
  )
}

export function DashboardInventoryView() {
  const router = useRouter()

  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [stockStatus, setStockStatus] = React.useState<InventoryStatus | ''>('')
  const [storageTemp, setStorageTemp] = React.useState('')
  const [sortBy, setSortBy] = React.useState<InventorySortField>('expiry')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const [loadState, setLoadState] = React.useState<LoadState>('loading')
  const [todayISO, setTodayISO] = React.useState('')
  const [kpis, setKpis] = React.useState<InventoryKpis | null>(null)
  const [items, setItems] = React.useState<InventoryRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(1)

  const [alertDismissed, setAlertDismissed] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(
    null,
  )
  const [actionBusy, setActionBusy] = React.useState(false)
  const [visibleCols, setVisibleCols] = React.useState<
    Record<ToggleableColumnId, boolean>
  >({
    irc: true,
    batchNo: true,
    location: true,
    actions: true,
  })

  const requestIdRef = React.useRef(0)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadData = React.useCallback(async () => {
    const reqId = ++requestIdRef.current
    setLoadState('loading')
    try {
      const res = await fetchInventoryDashboard({
        search: search || undefined,
        category: category || undefined,
        stockStatus: stockStatus || undefined,
        storageTemp: storageTemp || undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      })
      if (reqId !== requestIdRef.current) return
      setTodayISO(res.todayISO)
      setKpis(res.kpis)
      setItems(res.items)
      setTotal(res.total)
      setPageCount(Math.max(1, res.pageCount))
      setSelectedIds(new Set())
      setLoadState('ready')
    } catch {
      if (reqId !== requestIdRef.current) return
      setLoadState('error')
    }
  }, [category, page, pageSize, search, sortBy, sortDir, stockStatus, storageTemp])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      await loadData()
    })()
    return () => {
      cancelled = true
    }
  }, [loadData])

  const handleSort = React.useCallback((field: InventorySortField) => {
    setSortBy((prevField) => {
      if (prevField === field) {
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'))
        return prevField
      }
      setSortDir('asc')
      return field
    })
    setPage(1)
  }, [])

  const clearAllFilters = React.useCallback(() => {
    setSearchInput('')
    setSearch('')
    setCategory('')
    setStockStatus('')
    setStorageTemp('')
    setPage(1)
  }, [])

  const hasFilters = Boolean(search || category || stockStatus || storageTemp)

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadInventoryExcelCsv({
        search: search || undefined,
        category: category || undefined,
        stockStatus: stockStatus || undefined,
        storageTemp: storageTemp || undefined,
        sortBy,
        sortDir,
      })
      toast.success('فایل گزارش موجودی انبار با موفقیت دریافت شد.')
    } catch {
      toast.error('دریافت گزارش اکسل ناموفق بود.')
    } finally {
      setExporting(false)
    }
  }

  const allOnPageSelected =
    items.length > 0 && items.every((row) => selectedIds.has(row.batchId))

  const toggleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds(new Set())
        return
      }
      setSelectedIds(new Set(items.map((r) => r.batchId)))
    },
    [items],
  )

  const toggleSelectRow = React.useCallback((batchId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(batchId)
      else next.delete(batchId)
      return next
    })
  }, [])

  const confirmPendingAction = async () => {
    if (!pendingAction) return
    setActionBusy(true)
    try {
      if (pendingAction.kind === 'single') {
        await updateSingleBatchStatus(pendingAction.batchId, pendingAction.status)
        toast.success(`اقدام «${pendingAction.label}» برای سری ساخت ثبت شد.`)
      } else {
        const res = await bulkUpdateInventoryStatus(
          pendingAction.batchIds,
          pendingAction.status,
        )
        toast.success(
          `وضعیت ${formatPersianNumber(res.updatedCount)} سری ساخت به «${pendingAction.label}» تغییر یافت.`,
        )
      }
      setPendingAction(null)
      await loadData()
    } catch {
      toast.error('اعمال تغییر وضعیت سری ساخت با خطا مواجه شد.')
    } finally {
      setActionBusy(false)
    }
  }

  const columns = React.useMemo<DenseColumn<InventoryRow>[]>(() => {
    const base: DenseColumn<InventoryRow>[] = [
      {
        id: 'select',
        header: (
          <Checkbox
            aria-label="انتخاب همه سطرهای صفحه"
            checked={allOnPageSelected}
            onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
          />
        ),
        cell: (row) => (
          <Checkbox
            aria-label={`انتخاب ${row.nameFa} ${row.batchNo}`}
            checked={selectedIds.has(row.batchId)}
            onCheckedChange={(checked) =>
              toggleSelectRow(row.batchId, Boolean(checked))
            }
          />
        ),
        headerClassName: 'w-11 text-center',
        className: 'w-11 text-center',
      },
      {
        id: 'nameFa',
        header: (
          <SortableHeader
            label="نام دارو و شکل دارویی"
            field="nameFa"
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />
        ),
        ariaSort: sortAria('nameFa', sortBy, sortDir),
        cell: (row) => (
          <div className="max-w-[14rem]">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href={`/drug-details-cardex?drugId=${encodeURIComponent(row.drugId)}`}
                className="font-semibold text-text-primary hover:text-primary hover:underline"
              >
                {row.nameFa}
              </Link>
              {row.storageTemp === 'fridge' ? (
                <Badge variant="info" className="gap-0.5 px-1.5 py-0 text-label-sm">
                  <Icon name="ac_unit" size={12} data-slot="icon" />
                  یخچالی
                </Badge>
              ) : null}
              {row.isControlled ? (
                <Badge variant="critical" className="gap-0.5 px-1.5 py-0 text-label-sm">
                  <Icon name="lock" size={12} data-slot="icon" />
                  تحت کنترل
                </Badge>
              ) : null}
            </div>
            <div className="truncate font-latin text-label-sm text-text-secondary">
              {row.brandName || `${row.dosageForm} ${row.strength}`.trim()}
            </div>
          </div>
        ),
      },
    ]

    if (visibleCols.irc) {
      base.push({
        id: 'irc',
        header: 'کد ژنریک / IRC',
        dir: 'ltr',
        className: 'hidden xl:table-cell text-text-secondary',
        headerClassName: 'hidden xl:table-cell',
        cell: (row) => (
          <span className="font-latin text-label-sm tabular-nums-data">
            {row.genericCode || row.gtin || '—'}
          </span>
        ),
      })
    }

    if (visibleCols.batchNo) {
      base.push({
        id: 'batchNo',
        header: 'سری ساخت',
        dir: 'ltr',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <Badge variant="secondary" className="font-latin text-label-sm">
            {row.batchNo}
          </Badge>
        ),
      })
    }

    if (visibleCols.location) {
      base.push({
        id: 'location',
        header: 'موقعیت قفسه',
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        cell: (row) => (
          <div className="inline-flex items-center gap-1 text-label-md text-text-secondary">
            <Icon
              name={
                row.storageTemp === 'fridge'
                  ? 'kitchen'
                  : row.isControlled
                    ? 'lock'
                    : 'shelves'
              }
              size={16}
              className="text-primary"
              data-slot="icon"
            />
            <span className="font-latin tabular-nums-data">
              {row.locationLabel || '—'}
            </span>
          </div>
        ),
      })
    }

    base.push(
      {
        id: 'expiry',
        header: (
          <SortableHeader
            label="انقضای شمسی"
            field="expiry"
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />
        ),
        ariaSort: sortAria('expiry', sortBy, sortDir),
        cell: (row) => {
          const isDanger =
            row.expiryBucket === 'expired' || row.expiryBucket === 'critical'
          const isWarn = row.expiryBucket === 'warning'
          return (
            <div className="tabular-nums-data">
              <div
                className={cn(
                  'font-medium',
                  isDanger
                    ? 'text-status-critical-fg'
                    : isWarn
                      ? 'text-status-expiring-fg'
                      : 'text-text-primary',
                )}
              >
                {formatJalaliDate(row.expiry)}
              </div>
              <div
                className={cn(
                  'text-label-sm',
                  isDanger
                    ? 'text-status-critical-fg'
                    : isWarn
                      ? 'text-status-expiring-fg'
                      : 'text-text-secondary',
                )}
              >
                {remainingDaysText(row.daysUntilExpiry, row.expiryBucket)}
              </div>
            </div>
          )
        },
      },
      {
        id: 'quantity',
        header: (
          <SortableHeader
            label="موجودی / آستانه"
            field="quantity"
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />
        ),
        ariaSort: sortAria('quantity', sortBy, sortDir),
        cell: (row) => {
          const ratio = stockCoverageRatio(row.quantity, row.reorderLevel)
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 whitespace-nowrap tabular-nums-data text-body-sm">
                <span
                  className={cn(
                    'font-bold',
                    row.inventoryStatus === 'low'
                      ? 'text-status-warning-fg'
                      : row.inventoryStatus === 'expired_quarantine'
                        ? 'text-status-critical-fg'
                        : 'text-primary',
                  )}
                >
                  {formatPersianNumber(row.quantity)}
                </span>
                <span className="text-label-sm text-text-secondary">
                  / {formatPersianNumber(row.reorderLevel)} {row.unitLabel}
                </span>
              </div>
              <Progress value={ratio} className="h-1.5 w-20" />
            </div>
          )
        },
      },
      {
        id: 'inventoryStatus',
        header: 'وضعیت انقضا و انبار',
        cell: (row) => {
          const meta = INVENTORY_STATUS_META[row.inventoryStatus]
          return (
            <TriageStatusBadge status={meta.triage}>
              {row.batchStatus === 'quarantined' ? 'قرنطینه شده' : meta.label}
            </TriageStatusBadge>
          )
        },
      },
    )

    if (visibleCols.actions) {
      base.push({
        id: 'actions',
        header: 'عملیات',
        align: 'end',
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            {row.inventoryStatus === 'low' ? (
              <ActionTooltip title="سفارش مجدد کالا">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/auto-reorder-suggestions')}
                >
                  <Icon name="add_shopping_cart" size={14} data-slot="icon" />
                  سفارش
                </Button>
              </ActionTooltip>
            ) : null}

            {row.inventoryStatus === 'expiring' && row.batchStatus === 'active' ? (
              <ActionTooltip title="توزیع سریع (FEFO)">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setPendingAction({
                      kind: 'single',
                      batchId: row.batchId,
                      status: 'quick_sale',
                      label: 'توزیع سریع (FEFO)',
                    })
                  }
                >
                  <Icon name="send_to_mobile" size={14} data-slot="icon" />
                  توزیع سریع
                </Button>
              </ActionTooltip>
            ) : null}

            {row.inventoryStatus === 'expired_quarantine' &&
            row.batchStatus !== 'quarantined' ? (
              <ActionTooltip title="قرنطینه و صورتجلسه امحا">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    setPendingAction({
                      kind: 'single',
                      batchId: row.batchId,
                      status: 'quarantined',
                      label: 'قرنطینه و صورتجلسه امحا',
                    })
                  }
                >
                  <Icon name="delete_sweep" size={14} data-slot="icon" />
                  قرنطینه
                </Button>
              </ActionTooltip>
            ) : null}

            <ActionTooltip title="مشاهده کاردکس کالا">
              <Link
                href={`/drug-details-cardex?drugId=${encodeURIComponent(row.drugId)}`}
                aria-label={`مشاهده کاردکس ${row.nameFa}`}
                className="ps-focus-ring inline-flex size-8 items-center justify-center rounded-default text-text-secondary hover:bg-surface-muted hover:text-primary"
              >
                <Icon name="receipt_long" size={18} data-slot="icon" />
              </Link>
            </ActionTooltip>

            <ActionTooltip title="ثبت حواله خروج">
              <Link
                href="/dispensing-dispatch"
                aria-label={`ثبت حواله خروج ${row.nameFa}`}
                className="ps-focus-ring inline-flex size-8 items-center justify-center rounded-default text-text-secondary hover:bg-surface-muted hover:text-primary"
              >
                <Icon name="output" size={18} data-slot="icon" />
              </Link>
            </ActionTooltip>
          </div>
        ),
      })
    }

    return base
  }, [
    allOnPageSelected,
    handleSort,
    router,
    selectedIds,
    sortBy,
    sortDir,
    toggleSelectAll,
    toggleSelectRow,
    visibleCols,
  ])

  const activeChips = React.useMemo(() => {
    const chips: Array<{ id: string; label: string; clear: () => void }> = []
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
    if (category) {
      chips.push({
        id: 'category',
        label: `دسته: ${category}`,
        clear: () => {
          setCategory('')
          setPage(1)
        },
      })
    }
    if (stockStatus) {
      chips.push({
        id: 'stockStatus',
        label: `وضعیت: ${INVENTORY_STATUS_META[stockStatus].label}`,
        clear: () => {
          setStockStatus('')
          setPage(1)
        },
      })
    }
    if (storageTemp) {
      chips.push({
        id: 'storageTemp',
        label: `شرایط: ${STORAGE_TEMP_LABELS[storageTemp] ?? storageTemp}`,
        clear: () => {
          setStorageTemp('')
          setPage(1)
        },
      })
    }
    return chips
  }, [category, search, stockStatus, storageTemp])

  const selectedArray = React.useMemo(() => Array.from(selectedIds), [selectedIds])

  return (
    <AppShell
      navItems={getInventoryDashboardNavItems('dashboard-inventory')}
      sidebar={{
        brand: {
          title: 'انبار دارو',
          subtitle: 'سامانه جامع موجودی داروخانه',
        },
      }}
      header={{
        branchLabel: 'داروخانه دکتر حسینی (مرکزی)',
        searchPlaceholder: 'جستجوی نام دارو، کد ژنریک یا IRC...',
        onSearchChange: setSearchInput,
        actions: (
          <Button
            type="button"
            className="hidden sm:inline-flex"
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="add_circle" size={18} data-slot="icon" />
            ثبت داروی جدید
          </Button>
        ),
      }}
      contentClassName="space-y-space-lg"
    >
      {/* Breadcrumb & Page Header */}
      <section className="flex flex-col justify-between gap-space-md md:flex-row md:items-center">
        <div className="space-y-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">مدیریت داروخانه</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/shelf-inventory">انبار و موجودی</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>داشبورد و موجودی انبار دارو</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="text-headline-lg font-bold text-text-primary">
              داشبورد مدیریت انبار دارو
            </h1>
            {todayISO ? (
              <Badge variant="secondary" className="gap-1 tabular-nums-data">
                <Icon name="calendar_today" size={14} className="text-primary" data-slot="icon" />
                <span>{formatTodayJalaliBanner(todayISO)}</span>
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-space-xs">
          <Button type="button" onClick={() => setDrawerOpen(true)}>
            <Icon name="add_box" size={18} data-slot="icon" />
            ورود داروی جدید به انبار
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            <Icon name="download" size={18} data-slot="icon" />
            {exporting ? 'در حال تهیه...' : 'دریافت گزارش اکسل'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="به‌روزرسانی داده‌ها"
            onClick={() => void loadData()}
            disabled={loadState === 'loading'}
          >
            <Icon name="refresh" size={18} data-slot="icon" />
          </Button>
        </div>
      </section>

      {loadState === 'error' ? (
        <Card className="p-space-lg">
          <CardHeader className="p-0">
            <CardTitle>خطا در دریافت اطلاعات داشبورد موجودی</CardTitle>
            <CardDescription>
              ارتباط با سرویس انبار برقرار نشد. لطفاً دوباره تلاش کنید.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-4 p-0">
            <Button type="button" onClick={() => void loadData()}>
              تلاش مجدد
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {/* Top 4 KPI Cards */}
      {loadState === 'loading' && !kpis ? (
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-border-default bg-surface"
            />
          ))}
        </div>
      ) : kpis ? (
        <section
          aria-label="شاخص‌های کلیدی موجودی انبار"
          className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4"
        >
          <button
            type="button"
            className="ps-focus-ring rounded-xl text-start"
            onClick={clearAllFilters}
          >
            <KpiMetricCard
              title="کل اقلام دارویی موجود"
              value={`${formatPersianNumber(kpis.totalSkus)} قلم`}
              description={`در قالب ${formatPersianNumber(kpis.activeCategories)} دسته‌بندی درمانی فعال`}
              icon="inventory"
              tone="primary"
              delta={{
                label: `نرخ پوشش تقاضا: ${toPersianDigits(kpis.demandCoveragePct.toFixed(1))}٪`,
                direction: 'up',
              }}
            />
          </button>

          <button
            type="button"
            className="ps-focus-ring rounded-xl text-start"
            onClick={() => {
              setStockStatus('low')
              setPage(1)
            }}
          >
            <KpiMetricCard
              title="نیازمند سفارش مجدد"
              value={`${formatPersianNumber(kpis.belowRopCount)} مورد`}
              description={`${formatPersianNumber(kpis.criticalShortageCount)} قلم در وضعیت بحرانی کمبود موجودی`}
              icon="warning"
              tone="warning"
              delta={{
                label: `میانگین زمان تامین: ${toPersianDigits(kpis.avgLeadTimeDays.toFixed(1))} روز کاری`,
                direction: 'flat',
              }}
            />
          </button>

          <button
            type="button"
            className="ps-focus-ring rounded-xl text-start"
            onClick={() => {
              setStockStatus('expiring')
              setPage(1)
            }}
          >
            <KpiMetricCard
              title="نزدیک به انقضا (کمتر از ۹۰ روز)"
              value={`${formatPersianNumber(kpis.nearExpiryCount)} سری ساخت`}
              description={`ارزش ریالی ریسک: ${formatRial(kpis.nearExpiryValueRial)}`}
              icon="hourglass_top"
              tone="expiring"
              delta={{
                label: 'اولویت مصرف: پروتکل FEFO فعال',
                direction: 'flat',
              }}
            />
          </button>

          <button
            type="button"
            className="ps-focus-ring rounded-xl text-start"
            onClick={() => router.push('/shelf-inventory')}
          >
            <KpiMetricCard
              title="ارزش ریالی موجودی انبار"
              value={
                <span className="text-headline-md font-bold">
                  {formatRial(kpis.totalValuationRial)}
                </span>
              }
              description={`${formatPersianNumber(kpis.activeBatchCount)} سری ساخت فعال (${formatPersianNumber(kpis.totalUnits)} واحد)`}
              icon="account_balance_wallet"
              tone="valid"
              delta={{
                label: kpis.lastAuditISO
                  ? `آخرین ثبت ممیزی: ${formatJalaliDate(kpis.lastAuditISO)}`
                  : 'بدون رویداد ممیزی ثبت‌شده',
                direction: 'up',
              }}
            />
          </button>
        </section>
      ) : null}

      {/* Clinical Alert Banner (FEFO) */}
      {kpis && kpis.criticalExpiryCount > 0 && !alertDismissed ? (
        <AlertBanner
          tone="warning"
          title="هشدار توزیع سری‌های ساخت بحرانی (FEFO)"
          description={`${formatPersianNumber(kpis.criticalExpiryCount)} محموله دارویی در آستانه انقضا (کمتر از ۳۰ روز) یا منقضی قرار دارند. لطفاً فرآیند خروج بر مبنای FEFO (اولین انقضا، اولین خروج) را در تحویل نسخه‌ها اولویت دهید.`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setStockStatus('expiring')
                  setPage(1)
                }}
              >
                مشاهده سری‌های ساخت
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => router.push('/expiry-alerts-fefo?bucket=critical')}
              >
                مدیریت کامل انقضا
              </Button>
            </div>
          }
          onDismiss={() => setAlertDismissed(true)}
        />
      ) : null}

      {/* Inventory Data Table Container */}
      <Card className="min-w-0 w-full gap-0 overflow-hidden p-0">
        {/* Toolbar */}
        <CardContent className="space-y-3 border-b border-border-default p-space-md">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full xl:w-72">
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-secondary"
                data-slot="icon"
              />
              <Input
                aria-label="فیلتر موجودی انبار"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="فیلتر بر اساس نام، IRC یا بچ..."
                className="ps-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={category || 'all'}
                onValueChange={(val) => {
                  setCategory(val === 'all' ? '' : val)
                  setPage(1)
                }}
              >
                <SelectTrigger aria-label="فیلتر دسته درمانی" className="w-auto min-w-[11rem]">
                  <SelectValue placeholder="همه دسته‌های درمانی" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">همه دسته‌های درمانی</SelectItem>
                    {DRUG_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={stockStatus || 'all'}
                onValueChange={(val) => {
                  setStockStatus(val === 'all' ? '' : (val as InventoryStatus))
                  setPage(1)
                }}
              >
                <SelectTrigger aria-label="فیلتر وضعیت موجودی" className="w-auto min-w-[11rem]">
                  <SelectValue placeholder="همه وضعیت‌های موجودی" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">همه وضعیت‌های موجودی</SelectItem>
                    <SelectItem value="valid">موجود و معتبر</SelectItem>
                    <SelectItem value="low">روبه‌اتمام (کسری)</SelectItem>
                    <SelectItem value="expiring">نزدیک به انقضا</SelectItem>
                    <SelectItem value="expired_quarantine">منقضی / قرنطینه</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={storageTemp || 'all'}
                onValueChange={(val) => {
                  setStorageTemp(val === 'all' ? '' : val)
                  setPage(1)
                }}
              >
                <SelectTrigger aria-label="فیلتر شرایط نگهداری" className="w-auto min-w-[10.5rem]">
                  <SelectValue placeholder="همه شرایط نگهداری" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">همه شرایط نگهداری</SelectItem>
                    <SelectItem value="room">دمای اتاق (۱۵ تا ۲۵°C)</SelectItem>
                    <SelectItem value="fridge">یخچالی (۲ تا ۸°C)</SelectItem>
                    <SelectItem value="light">محافظت دقیق از نور</SelectItem>
                    <SelectItem value="freezer">فریزر (زیر صفر)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {/* Column Visibility Toggle */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline">
                    <Icon name="view_column" size={18} data-slot="icon" />
                    <span className="hidden sm:inline">ستون‌ها</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 space-y-2 p-3">
                  <p className="text-label-md font-semibold text-text-primary">
                    نمایش ستون‌های جدول
                  </p>
                  {(
                    [
                      ['irc', 'کد ژنریک / IRC'],
                      ['batchNo', 'سری ساخت (Batch)'],
                      ['location', 'موقعیت قفسه'],
                      ['actions', 'عملیات'],
                    ] as const
                  ).map(([id, label]) => (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 text-body-sm text-text-primary"
                    >
                      <Checkbox
                        checked={visibleCols[id]}
                        onCheckedChange={(checked) =>
                          setVisibleCols((prev) => ({
                            ...prev,
                            [id]: Boolean(checked),
                          }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Bulk Operations */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={selectedArray.length > 0 ? 'secondary' : 'outline'}
                  >
                    <Icon name="rule" size={18} data-slot="icon" />
                    <span>
                      عملیات گروهی
                      {selectedArray.length > 0
                        ? ` (${formatPersianNumber(selectedArray.length)})`
                        : ''}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 space-y-1.5 p-2">
                  {selectedArray.length === 0 ? (
                    <p className="p-2 text-body-sm text-text-secondary">
                      ابتدا یک یا چند ردیف را از جدول انتخاب کنید.
                    </p>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start text-status-critical-fg"
                        onClick={() =>
                          setPendingAction({
                            kind: 'bulk',
                            batchIds: selectedArray,
                            status: 'quarantined',
                            label: 'قرنطینه گروهی',
                          })
                        }
                      >
                        <Icon name="block" size={16} data-slot="icon" />
                        انتقال گروهی به قرنطینه
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start text-status-expiring-fg"
                        onClick={() =>
                          setPendingAction({
                            kind: 'bulk',
                            batchIds: selectedArray,
                            status: 'quick_sale',
                            label: 'اولویت فروش سریع (FEFO)',
                          })
                        }
                      >
                        <Icon name="send_to_mobile" size={16} data-slot="icon" />
                        علامت‌گذاری فروش سریع
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() =>
                          setPendingAction({
                            kind: 'bulk',
                            batchIds: selectedArray,
                            status: 'active',
                            label: 'بازگردانی به وضعیت فعال',
                          })
                        }
                      >
                        <Icon name="check_circle" size={16} data-slot="icon" />
                        بازگردانی به وضعیت فعال
                      </Button>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {activeChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <Badge key={chip.id} variant="secondary" className="gap-1.5 py-1">
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    aria-label={`حذف فیلتر ${chip.label}`}
                    onClick={chip.clear}
                    className="rounded-full hover:text-status-critical-fg"
                  >
                    <Icon name="close" size={14} data-slot="icon" />
                  </button>
                </Badge>
              ))}
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={clearAllFilters}
              >
                پاک‌سازی همه فیلترها
              </Button>
            </div>
          ) : null}
        </CardContent>

        {/* Table Body */}
        {loadState === 'loading' ? (
          <div className="space-y-2 p-space-md">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-default bg-surface-muted"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Icon
              name="inventory_2"
              size={40}
              className="text-text-secondary"
              data-slot="icon"
            />
            <div className="space-y-1">
              <p className="text-title-md font-semibold text-text-primary">
                {hasFilters
                  ? 'هیچ سری ساختی با فیلترهای انتخاب‌شده یافت نشد'
                  : 'هنوز موجودی دارویی در انبار ثبت نشده است'}
              </p>
              <p className="text-body-sm text-text-secondary">
                {hasFilters
                  ? 'فیلترها را تغییر دهید یا جستجو را پاک کنید.'
                  : 'با دکمه «ورود داروی جدید به انبار» اولین سری ساخت را ثبت کنید.'}
              </p>
            </div>
            {hasFilters ? (
              <Button type="button" variant="outline" onClick={clearAllFilters}>
                پاک‌سازی فیلترها
              </Button>
            ) : (
              <Button type="button" onClick={() => setDrawerOpen(true)}>
                ورود داروی جدید به انبار
              </Button>
            )}
          </div>
        ) : (
          <DenseDataTable
            columns={columns}
            data={items}
            getRowId={(row) => row.batchId}
            maxHeight="min(36rem, 62vh)"
            className="rounded-none border-0"
            caption="فهرست لحظه‌ای موجودی و سری‌های ساخت انبار دارو"
          />
        )}

        {/* Pagination */}
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
      </Card>

      {/* Side Drawer: Stock-In */}
      <StockInDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={() => void loadData()}
      />

      {/* Confirm Dialog for Single / Bulk Status Actions */}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !actionBusy) setPendingAction(null)
        }}
        tone={pendingAction?.status === 'quarantined' ? 'critical' : 'warning'}
        title={pendingAction ? `تأیید ${pendingAction.label}` : 'تأیید اقدام'}
        description={
          pendingAction?.kind === 'bulk'
            ? `آیا از اعمال «${pendingAction.label}» روی ${formatPersianNumber(pendingAction.batchIds.length)} سری ساخت انتخاب‌شده اطمینان دارید؟ این تغییر در ممیزی سامانه ثبت می‌شود.`
            : `آیا از اعمال «${pendingAction?.label ?? ''}» روی این سری ساخت اطمینان دارید؟`
        }
        confirmLabel={actionBusy ? 'در حال ثبت...' : 'تأیید و ثبت'}
        cancelLabel="انصراف"
        onConfirm={() => void confirmPendingAction()}
      />
    </AppShell>
  )
}
