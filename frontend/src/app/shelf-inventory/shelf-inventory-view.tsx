'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Checkbox,
  Icon,
  Input,
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
  DenseDataTable,
  KpiMetricCard,
  PageHeader,
  Pagination,
  SideDrawer,
  TriageStatusBadge,
  type DenseColumn,
} from '@/components/shared'
import {
  WarehouseRackGrid,
  type RackCell,
  type RackCellStatus,
} from '@/components/domain'
import {
  SHELF_ZONES,
  type ShelfBin,
  type ShelfKpis,
  type ShelfStockStatusFilter,
  type ShelfZoneId,
} from '@/lib/types/shelves'
import { fetchShelves } from '@/lib/shelves/data-access'
import { printShelfBinLabel } from '@/lib/shelves/print-bin-label'
import {
  deriveBinStatus,
  nearestExpiryIso,
  sortBatchesFefo,
  totalQuantity,
  type ShelfSortField,
} from '@/lib/shelves/shelf-query'
import {
  formatJalaliDate,
  formatPersianNumber,
  toPersianDigits,
} from '@/lib/persian'
import { cn } from '@/lib/utils'
import { getShelfNavItems } from './nav'

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const SEARCH_DEBOUNCE_MS = 300

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type ViewMode = 'list' | 'grid'
type MacroTab = 'all' | 'main' | 'dispensing' | 'cold'

type ActiveChip = {
  id: string
  label: string
  clear: () => void
}

const STOCK_STATUS_LABELS: Record<ShelfStockStatusFilter, string> = {
  empty: 'خالی',
  occupied: 'اشغال',
  low: 'موجودی کم',
  expiring: 'نزدیک انقضا',
  controlled: 'تحت کنترل',
}

const MACRO_LABELS: Record<ShelfBin['macroLocation'], string> = {
  main: 'انبار مرکزی',
  dispensing: 'پیشخوان و سالن تحویل',
  cold: 'سردخانه و یخچال',
  controlled: 'انبار مرکزی (گاوصندوق)',
}

const MACRO_ICONS: Record<ShelfBin['macroLocation'], 'warehouse' | 'point_of_sale' | 'severe_cold' | 'lock'> =
  {
    main: 'warehouse',
    dispensing: 'point_of_sale',
    cold: 'severe_cold',
    controlled: 'lock',
  }

function toGridStatus(status: ReturnType<typeof deriveBinStatus>): RackCellStatus {
  return status
}

function AddressChips({ bin }: { bin: ShelfBin }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 font-latin text-[12px] tabular-nums-data"
      dir="ltr"
    >
      <span className="rounded-inner bg-surface-subtle px-2 py-0.5 font-semibold text-text-primary">
        {bin.zoneLabel.split('(')[0]?.trim() || bin.zone}
      </span>
      <span className="text-text-muted" aria-hidden>
        &gt;
      </span>
      <span className="rounded-inner bg-surface-subtle px-2 py-0.5 font-semibold text-text-primary">
        {bin.zone}-{bin.rack}
      </span>
      <span className="text-text-muted" aria-hidden>
        &gt;
      </span>
      <span className="rounded-inner bg-surface-subtle px-2 py-0.5 font-semibold text-text-primary">
        {bin.shelf}
      </span>
      <span className="text-text-muted" aria-hidden>
        &gt;
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-inner px-2 py-0.5 font-bold',
          bin.isControlled
            ? 'border border-status-critical-border bg-status-critical-bg text-status-critical-fg'
            : 'bg-primary-tint text-primary',
        )}
      >
        <span
          className={cn(
            'size-1.5 rounded-full',
            bin.isControlled ? 'bg-status-critical-fg' : 'bg-primary',
          )}
          aria-hidden
        />
        {bin.address}
      </span>
    </div>
  )
}

export function ShelfInventoryView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const viewParam = searchParams.get('view')
  const view: ViewMode = viewParam === 'grid' ? 'grid' : 'list'

  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [zone, setZone] = React.useState<ShelfZoneId | ''>('')
  const [stockStatus, setStockStatus] = React.useState<ShelfStockStatusFilter | ''>('')
  const [controlledOnly, setControlledOnly] = React.useState(false)
  const [expiringSoon, setExpiringSoon] = React.useState(false)
  const [macroTab, setMacroTab] = React.useState<MacroTab>('all')
  const [sortBy, setSortBy] = React.useState<ShelfSortField>('address')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)
  const [loadState, setLoadState] = React.useState<LoadState>('loading')
  const [items, setItems] = React.useState<ShelfBin[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(1)
  const [kpis, setKpis] = React.useState<ShelfKpis | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [activeBin, setActiveBin] = React.useState<ShelfBin | null>(null)
  const originFocusRef = React.useRef<HTMLElement | null>(null)
  const requestIdRef = React.useRef(0)

  const setView = React.useCallback(
    (next: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'list') params.delete('view')
      else params.set('view', next)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

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
        zone,
        stockStatus,
        controlledOnly,
        expiringSoon,
        macroTab,
        sortBy,
        sortDir,
        page,
        pageSize,
        view,
      }),
    [
      search,
      zone,
      stockStatus,
      controlledOnly,
      expiringSoon,
      macroTab,
      sortBy,
      sortDir,
      page,
      pageSize,
      view,
    ],
  )

  const load = React.useCallback(async () => {
    const requestId = ++requestIdRef.current
    try {
      const result = await fetchShelves({
        search,
        zone,
        stockStatus,
        controlledOnly,
        expiringSoon,
        macroLocation: macroTab === 'all' ? '' : macroTab,
        sortBy,
        sortDir,
        page: view === 'grid' ? 1 : page,
        pageSize: view === 'grid' ? 100 : pageSize,
      })
      if (requestId !== requestIdRef.current) return
      setItems(result.items)
      setTotal(result.total)
      setPageCount(view === 'grid' ? 1 : result.pageCount)
      if (view !== 'grid') setPage(result.page)
      setKpis(result.kpis)
      setLoadState('ready')
    } catch {
      if (requestId !== requestIdRef.current) return
      setLoadState('error')
    }
  }, [
    search,
    zone,
    stockStatus,
    controlledOnly,
    expiringSoon,
    sortBy,
    sortDir,
    page,
    pageSize,
    view,
    macroTab,
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
    setZone('')
    setStockStatus('')
    setControlledOnly(false)
    setExpiringSoon(false)
    setMacroTab('all')
    setPage(1)
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
  if (zone) {
    const zoneLabel = SHELF_ZONES.find((z) => z.id === zone)?.label ?? zone
    chips.push({
      id: 'zone',
      label: `ناحیه: ${zoneLabel}`,
      clear: () => {
        setZone('')
        setPage(1)
      },
    })
  }
  if (stockStatus) {
    chips.push({
      id: 'stock',
      label: `وضعیت: ${STOCK_STATUS_LABELS[stockStatus]}`,
      clear: () => {
        setStockStatus('')
        setPage(1)
      },
    })
  }
  if (controlledOnly) {
    chips.push({
      id: 'controlled',
      label: 'منطقه تحت کنترل',
      clear: () => {
        setControlledOnly(false)
        setPage(1)
      },
    })
  }
  if (expiringSoon) {
    chips.push({
      id: 'expiring',
      label: 'نزدیک به انقضا',
      clear: () => {
        setExpiringSoon(false)
        setPage(1)
      },
    })
  }

  function openBinDetails(bin: ShelfBin, origin?: HTMLElement | null) {
    originFocusRef.current = origin ?? (document.activeElement as HTMLElement | null)
    setActiveBin(bin)
    setDrawerOpen(true)
  }

  function handleDrawerOpenChange(open: boolean) {
    setDrawerOpen(open)
    if (!open) {
      setActiveBin(null)
      window.setTimeout(() => {
        originFocusRef.current?.focus?.()
        originFocusRef.current = null
      }, 0)
    }
  }

  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id))

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) items.forEach((item) => next.add(item.id))
      else items.forEach((item) => next.delete(item.id))
      return next
    })
  }

  const gridColumns = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(Math.max(items.length, 1)))))
  const gridCells: RackCell[] = items.map((bin) => {
    const binStatus = deriveBinStatus(bin)
    const status = toGridStatus(binStatus)
    const qty = totalQuantity(bin)
    return {
      id: bin.id,
      label: bin.address,
      status,
      title: bin.isControlled
        ? `${bin.zoneLabel} · تحت کنترل · ${formatPersianNumber(qty)} قلم`
        : `${bin.zoneLabel} · ${STOCK_STATUS_LABELS[binStatus]} · ${formatPersianNumber(qty)} قلم`,
    }
  })

  const columns: DenseColumn<ShelfBin>[] = [
    {
      id: 'select',
      header: (
        <Checkbox
          aria-label="انتخاب همه ردیف‌های صفحه"
          checked={allOnPageSelected}
          onCheckedChange={(checked) => toggleSelectAll(checked === true)}
        />
      ),
      className: 'w-10',
      cell: (row) => (
        <Checkbox
          aria-label={`انتخاب ${row.address}`}
          checked={selectedIds.has(row.id)}
          onCheckedChange={(checked) => {
            setSelectedIds((prev) => {
              const next = new Set(prev)
              if (checked === true) next.add(row.id)
              else next.delete(row.id)
              return next
            })
          }}
          onClick={(event) => event.stopPropagation()}
        />
      ),
    },
    {
      id: 'drug',
      header: 'فرآورده دارویی / شناسه ژنریک',
      cell: (row) => {
        const primary = sortBatchesFefo(row)[0]
        const letter = (primary?.nameFa ?? row.zone).charAt(0)
        return (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-inner text-label-lg font-bold',
                row.isControlled
                  ? 'bg-status-critical-bg text-status-critical-fg'
                  : row.macroLocation === 'cold'
                    ? 'bg-status-info-bg text-status-info-fg'
                    : 'bg-surface-subtle text-primary',
              )}
            >
              {row.isControlled ? (
                <Icon name="lock" size={18} data-slot="icon" />
              ) : row.macroLocation === 'cold' ? (
                <Icon name="ac_unit" size={18} data-slot="icon" />
              ) : (
                letter
              )}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label-lg font-semibold text-text-primary">
                  {primary?.nameFa ?? 'سبد خالی'}
                </span>
                {row.isControlled ? (
                  <Badge variant="critical" className="rounded-inner">
                    داروی تحت کنترل ویژه
                  </Badge>
                ) : null}
                {row.macroLocation === 'cold' ? (
                  <Badge variant="secondary" className="rounded-inner">
                    یخچالی ۲-۸°
                  </Badge>
                ) : null}
              </div>
              <div className="font-latin text-label-sm text-text-secondary" dir="ltr">
                {row.address}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'macro',
      header: 'موقعیت کلان',
      cell: (row) => (
        <span className="inline-flex items-center gap-1 rounded-inner bg-primary-tint px-2.5 py-1 text-label-md text-primary">
          <Icon name={MACRO_ICONS[row.macroLocation]} size={14} data-slot="icon" />
          {MACRO_LABELS[row.macroLocation]}
        </span>
      ),
    },
    {
      id: 'address',
      header: 'آدرس دقیق فیزیکی (سالن > قفسه > ردیف > سبد)',
      cell: (row) => <AddressChips bin={row} />,
    },
    {
      id: 'batch',
      header: 'بچ نامبر',
      dir: 'ltr',
      cell: (row) => {
        const primary = sortBatchesFefo(row)[0]
        return (
          <span className="font-latin text-label-md font-semibold tabular-nums-data">
            {primary?.batchNo ?? '—'}
          </span>
        )
      },
    },
    {
      id: 'expiry',
      header: 'انقضا (FEFO)',
      cell: (row) => {
        const nearest = nearestExpiryIso(row)
        const status = deriveBinStatus(row)
        if (!nearest) return <span className="text-text-muted">—</span>
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="tabular-nums-data text-label-md font-semibold">
              {formatJalaliDate(nearest)}
            </span>
            {status === 'expiring' ? (
              <Badge variant="expiring" className="rounded-inner">
                اولویت FEFO
              </Badge>
            ) : (
              <Badge variant="secondary" className="rounded-inner">
                عادی
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      id: 'qty',
      header: 'موجودی این مکان',
      align: 'end',
      cell: (row) => (
        <span className="text-title-sm font-bold tabular-nums-data text-text-primary">
          {formatPersianNumber(totalQuantity(row))}
        </span>
      ),
    },
    {
      id: 'fill',
      header: 'ظرفیت سبد',
      cell: (row) => {
        const qty = totalQuantity(row)
        const pct =
          row.capacity > 0 ? Math.min(100, Math.round((qty / row.capacity) * 100)) : 0
        return (
          <div className="w-24 space-y-1">
            <div className="text-label-sm tabular-nums-data text-text-secondary">
              {formatPersianNumber(qty)} از {formatPersianNumber(row.capacity)}
            </div>
            <Progress value={pct} className="h-1.5" aria-hidden />
          </div>
        )
      },
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (row) => {
        const status = deriveBinStatus(row)
        const triage =
          status === 'empty'
            ? 'neutral'
            : status === 'occupied'
              ? 'valid'
              : status === 'low'
                ? 'warning'
                : status === 'expiring'
                  ? 'expiring'
                  : 'critical'
        return (
          <TriageStatusBadge status={triage}>
            {STOCK_STATUS_LABELS[status]}
          </TriageStatusBadge>
        )
      },
    },
    {
      id: 'actions',
      header: 'عملیات قفسه',
      align: 'end',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <ActionTooltip title="مشاهده جزئیات سبد/قفسه">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`جزئیات سبد ${row.address}`}
              onClick={(event) => {
                event.stopPropagation()
                openBinDetails(row, event.currentTarget)
              }}
            >
              <Icon name="visibility" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
          <ActionTooltip title="چاپ برچسب بارکد موقعیت">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`چاپ برچسب ${row.address}`}
              onClick={(event) => {
                event.stopPropagation()
                printShelfBinLabel(row)
              }}
            >
              <Icon name="label" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
        </div>
      ),
    },
  ]

  const catalogSize = kpis?.totalBins ?? 0
  const catalogEmpty = loadState === 'ready' && catalogSize === 0
  const noResults = loadState === 'ready' && total === 0 && !catalogEmpty
  const fefoBatches = activeBin ? sortBatchesFefo(activeBin) : []
  const nearestActive = activeBin ? nearestExpiryIso(activeBin) : null

  const tabCounts = React.useMemo(
    () => ({
      all: kpis?.totalBins ?? 0,
      main: kpis?.totalBins ?? 0,
      dispensing: kpis?.dispensingReady ?? 0,
      cold: 0,
    }),
    [kpis],
  )

  return (
    <AppShell
      navItems={getShelfNavItems('shelf')}
      sidebar={{
        brand: {
          title: 'انبار دارو',
          subtitle: 'سامانه جامع موجودی داروخانه',
        },
      }}
      header={{
        branchLabel: 'داروخانه دکتر حسینی (مرکزی)',
        searchPlaceholder: 'جستجوی نام دارو، کد ژنریک، بارکد یا شناسه IRC...',
        actions: (
          <Button type="button">
            <Icon name="add_circle" size={20} data-slot="icon" />
            ثبت داروی جدید
          </Button>
        ),
      }}
      contentClassName="space-y-6"
    >
      <PageHeader
        title="مدیریت و پایش موجودی به تفکیک موقعیت فیزیکی انبار"
        description="هماهنگ با سیستم چیدمان FEFO"
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">مدیریت داروخانه</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/shelf-inventory">عملیات انبارداری</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>موجودی فیزیکی بر اساس موقعیت</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          <>
            <Badge variant="secondary" className="gap-1.5 self-center">
              <span className="size-1.5 animate-pulse rounded-full bg-status-valid-fg" />
              هماهنگ با سیستم چیدمان FEFO
            </Badge>
            <Button type="button" variant="secondary">
              <Icon name="map" size={18} data-slot="icon" />
              راهنمای نقشه سه‌بعدی قفسه‌ها
            </Button>
            <Button type="button" variant="secondary">
              <Icon name="barcode_scanner" size={18} data-slot="icon" />
              اسکن بارکد سبد
            </Button>
            <Button type="button">
              <Icon name="swap_horiz" size={20} data-slot="icon" />
              ثبت انتقال داخلی اقلام
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiMetricCard
          title="کل ظرفیت انبار مرکزی"
          value={`${toPersianDigits(kpis?.capacityPct ?? 0)}٪`}
          description={`${formatPersianNumber(kpis?.occupiedBins ?? 0)} سبد اشغال از ${formatPersianNumber(kpis?.totalBins ?? 0)}`}
          icon="warehouse"
          tone="primary"
          delta={{
            label: `${formatPersianNumber(kpis?.emptyBins ?? 0)} سبد خالی`,
            direction: 'flat',
          }}
        />
        <KpiMetricCard
          title="موجودی فعال پیشخوان نسخ"
          value={formatPersianNumber(kpis?.dispensingReady ?? 0)}
          description="فرآورده آماده تحویل"
          icon="countertops"
          tone="valid"
          delta={{ label: 'گردش پرسرعت (Fast-Moving Bins)', direction: 'up' }}
        />
        <KpiMetricCard
          title="اقلام نیازمند شارژ پیشخوان"
          value={formatPersianNumber(kpis?.replenishNeeded ?? 0)}
          description="قلم دارای موجودی در انبار"
          icon="published_with_changes"
          tone="critical"
          delta={{ label: 'نیاز به اقدام فوری جابجایی', direction: 'down' }}
        />
        <KpiMetricCard
          title="پایش دمایی زنجیره سرد"
          value={`${toPersianDigits(String(kpis?.coldTempC ?? 4.2))}°C`}
          description="سردخانه و یخچال ۱"
          icon="ac_unit"
          tone="info"
          delta={{ label: 'بازه مجاز (۲ الی ۸ درجه)', direction: 'flat' }}
        />
      </section>

      <section
        data-slot="shelf-inventory-filters"
        className="flex flex-col gap-0 overflow-hidden rounded-default border border-border-default bg-surface"
      >
        <div className="flex flex-col gap-3 border-b border-border-subtle px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'همه موقعیت‌ها', icon: 'inventory_2' as const, count: tabCounts.all },
                { id: 'main', label: 'انبار مرکزی', icon: 'domain' as const, count: tabCounts.main },
                {
                  id: 'dispensing',
                  label: 'پیشخوان و سالن تحویل',
                  icon: 'point_of_sale' as const,
                  count: tabCounts.dispensing,
                },
                {
                  id: 'cold',
                  label: 'سردخانه و یخچال‌های ۲ الی ۸ درجه',
                  icon: 'severe_cold' as const,
                  count: tabCounts.cold,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-label-lg whitespace-nowrap transition-colors',
                  macroTab === tab.id
                    ? 'border-primary font-bold text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
                onClick={() => {
                  setMacroTab(tab.id)
                  setPage(1)
                }}
              >
                <Icon name={tab.icon} size={18} data-slot="icon" />
                <span>{tab.label}</span>
                <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-label-sm tabular-nums-data">
                  {formatPersianNumber(tab.count)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-2 sm:pb-0">
            <div
              className="inline-flex rounded-default border border-border-default p-0.5"
              role="group"
              aria-label="حالت نمایش"
            >
              <Button
                type="button"
                size="sm"
                variant={view === 'list' ? 'default' : 'ghost'}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <Icon name="view_list" size={16} data-slot="icon" />
                فهرست
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === 'grid' ? 'default' : 'ghost'}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <Icon name="grid_view" size={16} data-slot="icon" />
                نقشه قفسه
              </Button>
            </div>
            <Select
              value={`${sortBy}:${sortDir}`}
              onValueChange={(value) => {
                const [nextSort, nextDir] = value.split(':') as [ShelfSortField, 'asc' | 'desc']
                setSortBy(nextSort)
                setSortDir(nextDir)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[14rem]" aria-label="مرتب‌سازی">
                <SelectValue placeholder="مرتب‌سازی" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="address:asc">قفسه و آدرس فیزیکی (صعودی)</SelectItem>
                  <SelectItem value="expiry:asc">تاریخ انقضا (اولویت FEFO)</SelectItem>
                  <SelectItem value="quantity:desc">بیشترین موجودی</SelectItem>
                  <SelectItem value="nameFa:asc">نام دارو</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-text-placeholder"
                data-slot="icon"
              />
              <Input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="جستجو بر اساس نام دارو یا آدرس قفسه (مثلا A-04)..."
                className="h-10 ps-10"
                aria-label="جستجوی موقعیت یا دارو"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={zone || 'all'}
                onValueChange={(value) => {
                  setZone(value === 'all' ? '' : (value as ShelfZoneId))
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[13rem]" aria-label="فیلتر ناحیه">
                  <SelectValue placeholder="ناحیه" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">همه سالن‌ها / بخش‌ها</SelectItem>
                    {SHELF_ZONES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={stockStatus || 'all'}
                onValueChange={(value) => {
                  setStockStatus(
                    value === 'all' ? '' : (value as ShelfStockStatusFilter),
                  )
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[11rem]" aria-label="فیلتر وضعیت موجودی">
                  <SelectValue placeholder="وضعیت موجودی" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">وضعیت: همه</SelectItem>
                    {(Object.keys(STOCK_STATUS_LABELS) as ShelfStockStatusFilter[]).map(
                      (key) => (
                        <SelectItem key={key} value={key}>
                          {STOCK_STATUS_LABELS[key]}
                        </SelectItem>
                      ),
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant={controlledOnly ? 'default' : 'secondary'}
                size="sm"
                aria-pressed={controlledOnly}
                onClick={() => {
                  setControlledOnly((prev) => !prev)
                  setPage(1)
                }}
              >
                <Icon name="lock" size={16} data-slot="icon" />
                منطقه تحت کنترل
              </Button>

              <Button
                type="button"
                variant={expiringSoon ? 'default' : 'secondary'}
                size="sm"
                aria-pressed={expiringSoon}
                onClick={() => {
                  setExpiringSoon((prev) => !prev)
                  setPage(1)
                }}
              >
                <Icon name="event_busy" size={16} data-slot="icon" />
                نزدیک انقضا
              </Button>

              <Button type="button" variant="secondary" size="sm">
                <Icon name="print" size={16} data-slot="icon" />
                لیبل قفسه
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="بازنشانی فیلترها"
                onClick={clearAllFilters}
              >
                <Icon name="filter_alt_off" size={18} data-slot="icon" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-sm text-text-secondary">فیلترهای فعال:</span>
              {chips.length === 0 ? (
                <span className="text-label-sm text-text-muted">بدون فیلتر</span>
              ) : (
                chips.map((chip) => (
                  <Badge key={chip.id} variant="outline" className="gap-1 rounded-inner pe-1">
                    <span>{chip.label}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-5"
                      aria-label={`حذف فیلتر ${chip.label}`}
                      onClick={chip.clear}
                    >
                      <Icon name="close" size={14} data-slot="icon" />
                    </Button>
                  </Badge>
                ))
              )}
              {chips.length > 0 ? (
                <Button type="button" variant="link" size="sm" onClick={clearAllFilters}>
                  <Icon name="restart_alt" size={14} data-slot="icon" />
                  پاکسازی همه فیلترها
                </Button>
              ) : null}
            </div>
            <p className="text-label-sm text-text-secondary tabular-nums-data">
              نمایش{' '}
              <strong className="text-primary">{formatPersianNumber(total)}</strong> موقعیت
              از {formatPersianNumber(catalogSize)} سبد
            </p>
          </div>
        </div>
      </section>

      {loadState === 'error' ? (
        <AlertBanner
          tone="critical"
          title="خطا در بارگذاری موجودی قفسه‌ها"
          description="دریافت نقشه فیزیکی انبار با مشکل مواجه شد."
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              تلاش مجدد
            </Button>
          }
        />
      ) : null}

      {loadState === 'loading' ? (
        <div
          data-slot="shelf-inventory-skeleton"
          className="space-y-2 rounded-default border border-border-default bg-surface p-4"
          aria-busy="true"
          aria-label="در حال بارگذاری موجودی قفسه‌ها"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-inner bg-surface-subtle"
            />
          ))}
        </div>
      ) : null}

      {loadState === 'ready' && catalogEmpty ? (
        <AlertBanner
          tone="neutral"
          title="هنوز موقعیتی ثبت نشده"
          description="هیچ سبد یا قفسه‌ای در انبار تعریف نشده است."
        />
      ) : null}

      {noResults ? (
        <AlertBanner
          tone="info"
          title="نتیجه‌ای یافت نشد"
          description="با فیلتر یا عبارت جستجوی فعلی موقعیتی پیدا نشد."
          action={
            <Button type="button" size="sm" variant="outline" onClick={clearAllFilters}>
              پاکسازی فیلترها
            </Button>
          }
        />
      ) : null}

      {loadState === 'ready' && items.length > 0 && view === 'list' ? (
        <div className="overflow-hidden rounded-default border border-border-default bg-surface">
          <DenseDataTable
            columns={columns}
            data={items}
            getRowId={(row) => row.id}
            maxHeight="min(36rem, 62vh)"
            onRowClick={(row) => openBinDetails(row)}
            caption="جدول موجودی فیزیکی بر اساس موقعیت"
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
        </div>
      ) : null}

      {loadState === 'ready' && items.length > 0 && view === 'grid' ? (
        <div
          data-slot="shelf-inventory-grid"
          className="rounded-default border border-border-default bg-surface p-4"
        >
          <WarehouseRackGrid
            columns={gridColumns}
            cells={gridCells}
            selectedId={activeBin?.id ?? null}
            legend
            onSelect={(cellId) => {
              const bin = items.find((item) => item.id === cellId)
              if (!bin) return
              const origin = document.querySelector(
                `[data-slot="warehouse-rack-grid"] button[aria-label*="${bin.address}"]`,
              ) as HTMLElement | null
              openBinDetails(bin, origin)
            }}
          />
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-default border border-border-default bg-surface p-4">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3 text-title-md text-text-primary">
            <Icon name="account_tree" size={20} className="text-primary" data-slot="icon" />
            <span>راهنمای ساختار آدرس‌دهی سبدها (Bin Syntax)</span>
          </div>
          <p className="mt-3 text-body-sm text-text-secondary">
            فرمت استاندارد ثبت آدرس داروخانه جهت بارکدگذاری مکانیزه مطابق زنجیره ۴ سطحی چیدمان:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              { level: 'سطح ۱', title: 'سالن (Hall)', sample: 'سالن A' },
              { level: 'سطح ۲', title: 'قفسه (Shelf)', sample: 'A-04' },
              { level: 'سطح ۳', title: 'ردیف (Row)', sample: 'ردیف ۳' },
              { level: 'سطح ۴', title: 'سبد (Basket)', sample: 'سبد ۱۲' },
            ].map((item) => (
              <div key={item.level} className="rounded-inner bg-surface-subtle p-2">
                <span className="block text-label-sm text-text-muted">{item.level}</span>
                <span className="text-label-md font-bold text-primary">{item.title}</span>
                <span className="mt-1 block font-latin text-body-sm text-text-secondary" dir="ltr">
                  {item.sample}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-inner bg-surface-subtle px-3 py-2">
            <span className="text-label-sm text-text-muted">برچسب بارکدخوان تولیدی:</span>
            <span className="font-latin text-label-md font-bold text-primary" dir="ltr">
              A-03-2-04
            </span>
          </div>
        </div>

        <div className="rounded-default border border-border-default bg-surface p-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2 text-title-md text-text-primary">
              <Icon name="swap_horiz" size={20} className="text-secondary" data-slot="icon" />
              <span>حواله‌های باز جابجایی درون‌انبار</span>
            </div>
            <span className="text-label-sm font-bold text-primary">
              {toPersianDigits(3)} مورد در جریان
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center justify-between rounded-inner bg-surface-subtle p-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-status-critical-fg" aria-hidden />
                <div>
                  <div className="text-label-md font-semibold">انتقال آموکسی‌سیلین به پیشخوان</div>
                  <div className="text-label-sm text-text-muted">از قفسه A-01 به پیشخوان نسخه</div>
                </div>
              </div>
              <span className="text-label-sm font-bold text-status-critical-fg">فوری</span>
            </li>
            <li className="flex items-center justify-between rounded-inner bg-surface-subtle p-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-status-valid-fg" aria-hidden />
                <div>
                  <div className="text-label-md font-semibold">جابجایی بچ ورودی جدید سرم</div>
                  <div className="text-label-sm text-text-muted">از بارانداز به پالت حجیم B-08</div>
                </div>
              </div>
              <span className="text-label-sm font-bold text-status-valid-fg">عادی</span>
            </li>
          </ul>
        </div>

        <div className="rounded-default border border-border-default bg-surface p-4">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3 text-title-md text-text-primary">
            <Icon name="sensors" size={20} className="text-primary" data-slot="icon" />
            <span>آخرین وضعیت سنسورهای محیطی سالن‌ها</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-inner bg-surface-subtle p-3">
              <span className="block text-label-sm text-text-muted">رطوبت نسبی سالن اصلی</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-headline-sm font-bold tabular-nums-data">
                  {toPersianDigits(38)}٪
                </span>
                <span className="text-label-sm text-status-valid-fg">استاندارد</span>
              </div>
            </div>
            <div className="rounded-inner bg-surface-subtle p-3">
              <span className="block text-label-sm text-text-muted">دمای میانگین سالن A</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-headline-sm font-bold tabular-nums-data">
                  {toPersianDigits('21.4')}°C
                </span>
                <span className="text-label-sm text-status-valid-fg">بهینه</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-inner bg-surface-subtle px-3 py-2 text-label-md">
            <span>آخرین تاریخ انبارگردانی دوره‌ای:</span>
            <span className="font-bold text-primary tabular-nums-data">
              {formatJalaliDate('2024-10-01')}
            </span>
          </div>
        </div>
      </section>

      <SideDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        title={activeBin ? `جزئیات موقعیت ${activeBin.address}` : 'جزئیات موقعیت'}
        description="نمایش فقط‌خواندنی بچ‌ها با ترتیب FEFO"
      >
        {activeBin ? (
          <div className="space-y-4" data-slot="shelf-bin-drawer">
            <div className="space-y-2 rounded-inner border border-border-default bg-surface-subtle p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-latin text-title-md font-bold tabular-nums-data" dir="ltr">
                  {activeBin.address}
                </span>
                {activeBin.isControlled ? (
                  <Badge variant="critical" className="gap-1 rounded-inner">
                    <Icon name="lock" size={14} data-slot="icon" />
                    منطقه تحت کنترل
                  </Badge>
                ) : null}
              </div>
              <AddressChips bin={activeBin} />
              <p className="text-label-sm text-text-secondary">
                ظرفیت: {formatPersianNumber(totalQuantity(activeBin))} از{' '}
                {formatPersianNumber(activeBin.capacity)}
              </p>
            </div>

            {fefoBatches.length === 0 ? (
              <AlertBanner
                tone="neutral"
                title="سبد خالی است"
                description="در این موقعیت فیزیکی هیچ بچی ثبت نشده است."
              />
            ) : (
              <ul className="space-y-2" aria-label="فهرست بچ‌ها به ترتیب FEFO">
                {fefoBatches.map((batch) => {
                  const isNearest = batch.expiry === nearestActive
                  return (
                    <li
                      key={`${batch.batchNo}-${batch.expiry}`}
                      className={cn(
                        'rounded-inner border p-3',
                        isNearest
                          ? 'border-status-expiring-border bg-status-expiring-bg'
                          : 'border-border-default bg-surface',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-label-lg font-semibold text-text-primary">
                            {batch.nameFa}
                          </div>
                          <div className="mt-1 font-latin text-label-sm text-text-secondary" dir="ltr">
                            {batch.batchNo}
                          </div>
                        </div>
                        {isNearest ? (
                          <Badge variant="outline" className="rounded-inner">
                            نزدیک‌ترین انقضا
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-label-md">
                        <span className="tabular-nums-data">
                          انقضا: {formatJalaliDate(batch.expiry)}
                        </span>
                        <span className="tabular-nums-data font-bold text-primary">
                          تعداد: {formatPersianNumber(batch.quantity)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : null}
      </SideDrawer>
    </AppShell>
  )
}
