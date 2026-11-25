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
  PageHeader,
  Pagination,
  TriageStatusBadge,
  type DenseColumn,
} from '@/components/shared'
import {
  DOSAGE_FORMS,
  DRUG_CATEGORIES,
  type DosageForm,
  type Drug,
  type DrugCategory,
} from '@/lib/types/drugs'
import { fetchDrugs, lookupTtac, saveDrug } from '@/lib/drugs/data-access'
import { downloadCatalogCsv } from '@/lib/drugs/export-catalog-csv'
import { apiGetAllDrugs } from '@/lib/api/drugs'
import type { DrugFormValues } from './drug-form-drawer'
import {
  deriveStockStatus,
  type DrugSortField,
  type StockStatusFilter,
} from '@/lib/drugs/catalog-query'
import {
  formatJalaliDate,
  formatPersianNumber,
  toPersianDigits,
} from '@/lib/persian'
import { getCatalogNavItems } from './nav'
import { DrugFormDrawer } from './drug-form-drawer'

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const SEARCH_DEBOUNCE_MS = 300

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type ActiveChip = {
  id: string
  label: string
  clear: () => void
}

function sortAria(
  field: DrugSortField,
  sortBy: DrugSortField,
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
  field: DrugSortField
  sortBy: DrugSortField
  sortDir: 'asc' | 'desc'
  onSort: (field: DrugSortField) => void
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
        name={active ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
        size={14}
        data-slot="icon"
      />
    </button>
  )
}

export function DrugCatalogView() {
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [dosageForm, setDosageForm] = React.useState<DosageForm | ''>('')
  const [category, setCategory] = React.useState<DrugCategory | ''>('')
  const [controlled, setControlled] = React.useState<'all' | 'yes' | 'no'>('all')
  const [stockStatus, setStockStatus] = React.useState<StockStatusFilter | ''>('')
  const [sortBy, setSortBy] = React.useState<DrugSortField>('nameFa')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [loadState, setLoadState] = React.useState<LoadState>('loading')
  const [items, setItems] = React.useState<Drug[]>([])
  const [total, setTotal] = React.useState(0)
  const [catalogSize, setCatalogSize] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(1)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Drug | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
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
        dosageForm,
        category,
        controlled,
        stockStatus,
        sortBy,
        sortDir,
        page,
        pageSize,
      }),
    [
      search,
      dosageForm,
      category,
      controlled,
      stockStatus,
      sortBy,
      sortDir,
      page,
      pageSize,
    ],
  )

  const load = React.useCallback(async () => {
    const requestId = ++requestIdRef.current
    try {
      const result = await fetchDrugs({
        search,
        dosageForm,
        category,
        isControlled: controlled === 'all' ? null : controlled === 'yes',
        stockStatus,
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
      const filtersIdle =
        !search &&
        !dosageForm &&
        !category &&
        controlled === 'all' &&
        !stockStatus
      if (filtersIdle) setCatalogSize(result.total)
      setLoadState('ready')
    } catch {
      if (requestId !== requestIdRef.current) return
      setLoadState('error')
    }
  }, [
    search,
    dosageForm,
    category,
    controlled,
    stockStatus,
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

  function handleSort(field: DrugSortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  function clearAllFilters() {
    setSearchInput('')
    setSearch('')
    setDosageForm('')
    setCategory('')
    setControlled('all')
    setStockStatus('')
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
  if (dosageForm) {
    chips.push({
      id: 'dosage',
      label: `شکل: ${dosageForm}`,
      clear: () => {
        setDosageForm('')
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
  if (stockStatus) {
    const labels: Record<StockStatusFilter, string> = {
      valid: 'موجود',
      warning: 'موجودی کم',
      expiring: 'نزدیک انقضا',
      critical: 'ناموجود / بحرانی',
    }
    chips.push({
      id: 'stock',
      label: `وضعیت: ${labels[stockStatus]}`,
      clear: () => {
        setStockStatus('')
        setPage(1)
      },
    })
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

  function openCreate() {
    setEditing(null)
    setDrawerOpen(true)
  }

  function openEdit(drug: Drug) {
    setEditing(drug)
    setDrawerOpen(true)
  }

  async function handleSaved(values: DrugFormValues) {
    try {
      await saveDrug(
        {
          nameFa: values.nameFa,
          brandName: values.brandName,
          dosageForm: values.dosageForm,
          strength: values.strength,
          gtin: values.gtin,
          genericCode: values.genericCode,
          manufacturer: values.manufacturer,
          category: values.category,
          isControlled: values.isControlled,
          atcCode: values.atcCode || undefined,
          storageTemp: values.storageTemp,
          reorderLevel: Number(values.reorderLevel) || 0,
        },
        editing?.id ?? null,
      )
      toast.success(
        editing ? 'تغییرات قلم ذخیره شد.' : 'داروی جدید در کاتالوگ ثبت شد.',
      )
      setLoadState('loading')
      await load()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'ذخیره دارو ناموفق بود.',
      )
    }
  }

  async function handleExportCatalog() {
    try {
      const rows = await apiGetAllDrugs()
      downloadCatalogCsv(rows)
      toast.success('خروجی CSV کاتالوگ آماده شد.')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'خروجی کاتالوگ ناموفق بود.',
      )
    }
  }

  async function handleTtacSyncHint() {
    const sample = items[0]?.gtin?.trim()
    if (!sample) {
      toast.message(
        'برای استعلام TTAC از فرم ثبت/ویرایش دارو استفاده کنید؛ همگام‌سازی انبوه شبکهٔ واقعی TTAC در این نسخه نیست.',
      )
      return
    }
    const result = await lookupTtac(sample)
    if (result.status === 'found') {
      toast.success(`نمونه استعلام TTAC برای ${result.product.nameFa} موفق بود.`)
      return
    }
    if (result.status === 'not_found') {
      toast.message('نمونه استعلام TTAC نتیجه‌ای نداشت (کش محلی).')
      return
    }
    toast.error(result.status === 'error' ? result.message : 'استعلام TTAC ناموفق بود.')
  }

  const columns: DenseColumn<Drug>[] = [
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
          aria-label={`انتخاب ${row.nameFa}`}
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
      id: 'nameFa',
      ariaSort: sortAria('nameFa', sortBy, sortDir),
      header: (
        <SortableHeader
          label="نام فرآورده ژنریک و کد IRC"
          field="nameFa"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => (
        <div className="space-y-0.5">
          <Link
            href={`/drug-details-cardex?drugId=${row.id}`}
            className="text-label-lg font-semibold text-text-primary hover:text-primary"
            onClick={(event) => event.stopPropagation()}
          >
            {row.nameFa}
            {row.isControlled ? (
              <Icon
                name="lock"
                size={14}
                className="ms-1 inline align-middle text-status-critical-fg"
                data-slot="icon"
              />
            ) : null}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 text-label-sm text-text-secondary" dir="ltr">
            <span className="font-latin">{row.brandName}</span>
            <span aria-hidden>•</span>
            <span className="rounded-inner bg-surface-subtle px-1 font-latin text-[11px]">
              IRC: {row.genericCode}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'brandName',
      ariaSort: sortAria('brandName', sortBy, sortDir),
      header: (
        <SortableHeader
          label="نام تجاری و پروانه‌دار"
          field="brandName"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => (
        <div>
          <div className="font-medium text-text-primary">{row.brandName}</div>
          <div className="text-label-sm text-text-secondary">{row.manufacturer}</div>
        </div>
      ),
    },
    {
      id: 'dosageForm',
      ariaSort: sortAria('dosageForm', sortBy, sortDir),
      header: (
        <SortableHeader
          label="شکل و دوز"
          field="dosageForm"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => (
        <Badge variant="secondary" className="rounded-inner">
          {row.dosageForm} {toPersianDigits(row.strength)}
        </Badge>
      ),
    },
    {
      id: 'category',
      header: 'رده درمانی',
      cell: (row) => (
        <div>
          {row.atcCode ? (
            <div className="font-latin text-[12px] font-semibold text-primary" dir="ltr">
              {row.atcCode}
            </div>
          ) : null}
          <div className="text-[11px] text-text-secondary">{row.category}</div>
        </div>
      ),
    },
    {
      id: 'totalStock',
      ariaSort: sortAria('totalStock', sortBy, sortDir),
      header: (
        <SortableHeader
          label="موجودی انبار"
          field="totalStock"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      align: 'end',
      cell: (row) => {
        const max = Math.max(row.reorderLevel * 4, row.totalStock, 1)
        const pct = Math.min(100, Math.round((row.totalStock / max) * 100))
        return (
          <div className="ms-auto w-24 space-y-1">
            <div className="text-title-sm font-bold text-primary tabular-nums-data">
              {formatPersianNumber(row.totalStock)}
            </div>
            <Progress value={pct} className="h-1.5" aria-hidden />
          </div>
        )
      },
    },
    {
      id: 'nearestExpiry',
      ariaSort: sortAria('nearestExpiry', sortBy, sortDir),
      header: (
        <SortableHeader
          label="نزدیک‌ترین انقضا"
          field="nearestExpiry"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => (
        <span className="tabular-nums-data text-label-md">
          {formatJalaliDate(row.nearestExpiry)}
        </span>
      ),
    },
    {
      id: 'stockStatus',
      header: 'وضعیت موجودی',
      cell: (row) => <TriageStatusBadge status={deriveStockStatus(row)} />,
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <ActionTooltip title="مشاهده کاردکس کالا">
            <Link
              href={`/drug-details-cardex?drugId=${row.id}`}
              aria-label={`کاردکس ${row.nameFa}`}
              className="ps-focus-ring inline-flex size-8 items-center justify-center rounded-default text-text-secondary hover:bg-surface-hover hover:text-primary"
              onClick={(event) => event.stopPropagation()}
            >
              <Icon name="receipt_long" size={18} data-slot="icon" />
            </Link>
          </ActionTooltip>
          <ActionTooltip title="ویرایش مشخصات دارو">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`ویرایش ${row.nameFa}`}
              onClick={(event) => {
                event.stopPropagation()
                openEdit(row)
              }}
            >
              <Icon name="edit_note" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
        </div>
      ),
    },
  ]

  const catalogEmpty = loadState === 'ready' && catalogSize === 0
  const noResults = loadState === 'ready' && total === 0 && !catalogEmpty

  return (
    <AppShell
      navItems={getCatalogNavItems('catalog')}
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
          <Button type="button" onClick={openCreate}>
            <Icon name="add_circle" size={20} data-slot="icon" />
            ثبت داروی جدید
          </Button>
        ),
      }}
      contentClassName="space-y-6"
    >
      <PageHeader
        title="کاتالوگ جامع دارو و اقلام ژنریک"
        description={`${formatPersianNumber(catalogSize)} قلم ثبت‌شده در کاتالوگ`}
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">مدیریت داروخانه</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/drug-catalog">انبار و اطلاعات پایه</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>کاتالوگ دارو</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          <>
            <Badge variant="secondary" className="gap-1.5 self-center">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              {formatPersianNumber(catalogSize)} قلم
            </Badge>
            <Button type="button" variant="secondary" onClick={() => void handleTtacSyncHint()}>
              <Icon name="sync" size={20} data-slot="icon" />
              همگام‌سازی با فهرست رسمی TTAC
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handleExportCatalog()}>
              <Icon name="file_download" size={20} data-slot="icon" />
              خروجی اکسل کاتالوگ
            </Button>
            <Button type="button" onClick={openCreate}>
              <Icon name="add_circle" size={20} data-slot="icon" />
              تعریف داروی جدید +
            </Button>
          </>
        }
      />

      <section
        data-slot="drug-catalog-filters"
        className="flex flex-col gap-4 rounded-default border border-border-default bg-surface p-4"
      >
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
              placeholder="جستجو بر اساس نام ژنریک، نام تجاری، کد IRC، بارکد یا شناسه ATC..."
              className="h-10 ps-10"
              aria-label="جستجوی کاتالوگ دارو"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={dosageForm || 'all'}
              onValueChange={(value) => {
                setDosageForm(value === 'all' ? '' : (value as DosageForm))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[11rem]" aria-label="فیلتر شکل دارویی">
                <SelectValue placeholder="شکل دارویی" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">شکل دارویی: همه</SelectItem>
                  {DOSAGE_FORMS.map((form) => (
                    <SelectItem key={form} value={form}>
                      {form}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={category || 'all'}
              onValueChange={(value) => {
                setCategory(value === 'all' ? '' : (value as DrugCategory))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[12rem]" aria-label="فیلتر رده درمانی">
                <SelectValue placeholder="رده درمانی" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">رده درمانی: همه</SelectItem>
                  {DRUG_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={controlled}
              onValueChange={(value) => {
                setControlled(value as 'all' | 'yes' | 'no')
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[10rem]" aria-label="فیلتر تحت کنترل">
                <SelectValue placeholder="تحت کنترل" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">تحت کنترل: همه</SelectItem>
                  <SelectItem value="yes">فقط تحت کنترل</SelectItem>
                  <SelectItem value="no">غیرکنترلی</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={stockStatus || 'all'}
              onValueChange={(value) => {
                setStockStatus(
                  value === 'all' ? '' : (value as StockStatusFilter),
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
                  <SelectItem value="valid">دارای موجودی فعال</SelectItem>
                  <SelectItem value="warning">زیر نقطه سفارش</SelectItem>
                  <SelectItem value="expiring">نزدیک به انقضا</SelectItem>
                  <SelectItem value="critical">ناموجود / بحرانی</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
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
            <strong className="text-primary">{formatPersianNumber(total)}</strong> مورد
            فیلترشده از {formatPersianNumber(catalogSize)} قلم
          </p>
        </div>
      </section>

      {loadState === 'error' ? (
        <AlertBanner
          tone="critical"
          title="خطا در بارگذاری کاتالوگ"
          description="دریافت فهرست داروها با مشکل مواجه شد."
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              تلاش مجدد
            </Button>
          }
        />
      ) : null}

      {loadState === 'loading' ? (
        <div
          data-slot="drug-catalog-skeleton"
          className="space-y-2 rounded-default border border-border-default bg-surface p-4"
          aria-busy="true"
          aria-label="در حال بارگذاری کاتالوگ"
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
          title="کاتالوگ خالی است"
          description="هنوز هیچ قلم دارویی ثبت نشده است."
          action={
            <Button type="button" size="sm" onClick={openCreate}>
              ثبت اولین دارو
            </Button>
          }
        />
      ) : null}

      {noResults ? (
        <AlertBanner
          tone="info"
          title="نتیجه‌ای یافت نشد"
          description="با فیلتر یا عبارت جستجوی فعلی موردی پیدا نشد."
          action={
            <Button type="button" size="sm" variant="outline" onClick={clearAllFilters}>
              پاکسازی فیلترها
            </Button>
          }
        />
      ) : null}

      {loadState === 'ready' && items.length > 0 ? (
        <div className="overflow-hidden rounded-default border border-border-default bg-surface">
          <DenseDataTable
            columns={columns}
            data={items}
            getRowId={(row) => row.id}
            maxHeight="min(36rem, 62vh)"
            onRowClick={openEdit}
            caption="جدول کاتالوگ دارو"
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

      <DrugFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editing={editing}
        onSaved={handleSaved}
      />
    </AppShell>
  )
}
