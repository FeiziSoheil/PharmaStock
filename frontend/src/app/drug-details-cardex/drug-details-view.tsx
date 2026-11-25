'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
  CardHeader,
  CardTitle,
  Checkbox,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Label,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
  type TriageStatus,
} from '@/components/shared'
import {
  KardexTimeline,
  type KardexTimelineItem,
  type KardexTone,
} from '@/components/domain'
import {
  applyBatchQuery,
  marginPercent,
} from '@/lib/drug-details/batch-query'
import { computeRunningBalances } from '@/lib/drug-details/cardex-balance'
import {
  buildBarcodeLabelHtml,
  buildBatchesCsv,
  buildCardexPrintHtml,
} from '@/lib/drug-details/export'
import type {
  BatchFilter,
  DrugBatchRow,
  DrugDetailsTab,
  DrugDetailsUrlState,
} from '@/lib/drug-details/types'
import {
  DRUG_DETAILS_PAGE_SIZES,
  parseDrugDetailsUrlState,
  serializeDrugDetailsUrlState,
} from '@/lib/drug-details/url-state'
import {
  validateAddBatch,
  validateCatalogEdit,
  validateShelfMove,
  type CatalogEditInput,
} from '@/lib/drug-details/validation'
import { daysUntilExpiry, getExpiryBucket } from '@/lib/domain/expiry'
import {
  createDrugBatch,
  drugDetailsTodayISO,
  fetchCardexMovements,
  fetchDrugBatches,
  fetchDrugDetail,
  quarantineDrugBatch,
  relocateDrugBatch,
  saveDrugCatalog,
  type CardexMovement,
  type DrugDetailProfile,
} from '@/lib/drug-details/data-access'
import type { CardexMovementType } from '@/lib/types/cardex'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatPersianTime,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'
import { getDrugDetailsNavItems } from './nav'

const SEARCH_DEBOUNCE_MS = 300

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'not-found'

type ActiveDrawer =
  | 'add-batch'
  | 'edit-catalog'
  | 'move-shelf'
  | 'view-invoice'
  | null

type AddBatchFormState = {
  batchNo: string
  productionISO: string
  expiryISO: string
  quantity: string
  buyPriceRial: string
  consumerPriceRial: string
  locationLabel: string
  supplierLabel: string
}

type CatalogFormState = {
  nameFa: string
  brandName: string
  manufacturer: string
  atcCode: string
  gtin: string
  dosageForm: string
  strength: string
  reorderLevel: string
  isControlled: boolean
}

type ShelfFormState = {
  locationLabel: string
}

const EMPTY_ADD_BATCH: AddBatchFormState = {
  batchNo: '',
  productionISO: '',
  expiryISO: '',
  quantity: '',
  buyPriceRial: '',
  consumerPriceRial: '',
  locationLabel: '',
  supplierLabel: '',
}

function catalogFormFromDetail(detail: DrugDetailProfile): CatalogFormState {
  return {
    nameFa: detail.nameFa,
    brandName: detail.brandName,
    manufacturer: detail.manufacturer,
    atcCode: detail.atcCode,
    gtin: detail.gtin,
    dosageForm: detail.dosageForm,
    strength: detail.strength,
    reorderLevel: String(detail.reorderLevel),
    isControlled: detail.isControlled,
  }
}

function parseOptionalNumber(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return Number.NaN
  return Number(trimmed)
}

function focusFirstInvalid(
  prefix: string,
  errors: Record<string, string>,
  order: string[],
) {
  const first = order.find((key) => errors[key])
  if (!first) return
  window.setTimeout(() => {
    document.getElementById(`${prefix}-${first}`)?.focus()
  }, 0)
}

function restoreOriginFocus(originKey: string | null) {
  if (!originKey) return
  window.setTimeout(() => {
    document
      .querySelector<HTMLElement>(`[data-origin="${originKey}"]`)
      ?.focus()
  }, 0)
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-label-sm text-status-critical-fg" role="alert">
      {message}
    </p>
  )
}

const BATCH_FILTER_LABELS: Record<BatchFilter, string> = {
  all: 'همه بچ‌ها',
  'in-stock': 'دارای موجودی',
  expiring: 'نزدیک انقضا (< ۶ ماه)',
  quarantine: 'قرنطینه / مسدود شده',
}

const MOVEMENT_TYPE_LABELS: Record<CardexMovementType, string> = {
  inbound: 'ورود',
  outbound: 'خروج',
  transfer: 'جابجایی',
  adjustment: 'تعدیل',
  quarantine: 'قرنطینه',
}

function parseTodayISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function movementTone(type: CardexMovementType): KardexTone {
  if (type === 'inbound') return 'inbound'
  if (type === 'outbound') return 'outbound'
  if (type === 'quarantine') return 'alert'
  return 'neutral'
}

function movementIcon(type: CardexMovementType): string {
  switch (type) {
    case 'inbound':
      return 'inventory'
    case 'outbound':
      return 'point_of_sale'
    case 'transfer':
      return 'local_shipping'
    case 'adjustment':
      return 'verified_user'
    case 'quarantine':
      return 'block'
    default:
      return 'sync_alt'
  }
}

function remainingMonthsLabel(days: number | null): string {
  if (days === null) return 'نامشخص'
  if (days < 0) return `${formatPersianNumber(Math.abs(days))} روز گذشته`
  if (days === 0) return 'امروز منقضی می‌شود'
  const months = Math.max(1, Math.round(days / 30))
  if (days < 45) return `${formatPersianNumber(days)} روز مانده`
  return `${formatPersianNumber(months)} ماه باقی‌مانده`
}

function fefoBadge(
  row: DrugBatchRow,
  fefoPriorityIds: string[],
  today: Date,
): { label: string; status: TriageStatus } {
  if (row.status === 'quarantine' || row.status === 'blocked') {
    return { label: 'قرنطینه / مسدود', status: 'critical' }
  }
  const rank = fefoPriorityIds.indexOf(row.id)
  if (rank === 0) {
    return { label: 'اولویت ۱ خروج (FEFO)', status: 'valid' }
  }
  if (rank > 0) {
    return {
      label: `ایمن (اولویت ${toPersianDigits(rank + 1)})`,
      status: 'info',
    }
  }
  if (row.quantity <= 0) {
    return { label: 'بدون موجودی', status: 'neutral' }
  }
  const bucket = getExpiryBucket(row.expiryISO, today)
  if (bucket === 'expired') return { label: 'منقضی شده', status: 'critical' }
  if (bucket === 'critical' || bucket === 'warning') {
    return { label: 'نزدیک انقضا', status: 'expiring' }
  }
  return { label: 'رو به اتمام', status: 'neutral' }
}

function filterCount(
  rows: DrugBatchRow[],
  filter: BatchFilter,
  todayISO: string,
): number {
  return applyBatchQuery(rows, {
    batchFilter: filter,
    q: '',
    page: 1,
    pageSize: Math.max(rows.length, 1),
    todayISO,
  }).total
}

function buildCardexDisplay(movements: CardexMovement[]): Array<
  CardexMovement & { balance: number }
> {
  const chronological = [...movements].sort((a, b) =>
    a.timestampISO.localeCompare(b.timestampISO),
  )
  const balances = computeRunningBalances(
    chronological.map((m) => ({ id: m.id, qtyIn: m.qtyIn, qtyOut: m.qtyOut })),
  )
  return chronological
    .map((m) => ({ ...m, balance: balances.get(m.id) ?? 0 }))
    .reverse()
}

export function DrugDetailsView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initial = React.useMemo(
    () => parseDrugDetailsUrlState(new URLSearchParams(searchParams.toString())),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from URL
    [],
  )

  const [drugId, setDrugId] = React.useState(initial.drugId)
  const [tab, setTab] = React.useState<DrugDetailsTab>(initial.tab)
  const [batchFilter, setBatchFilter] = React.useState<BatchFilter>(
    initial.batchFilter,
  )
  const [searchInput, setSearchInput] = React.useState(initial.q)
  const [search, setSearch] = React.useState(initial.q)
  const [page, setPage] = React.useState(initial.page)
  const [pageSize, setPageSize] = React.useState(initial.pageSize)

  const [loadState, setLoadState] = React.useState<LoadState>('idle')
  const [detail, setDetail] = React.useState<DrugDetailProfile | null>(null)
  const [batches, setBatches] = React.useState<DrugBatchRow[]>([])
  const [movements, setMovements] = React.useState<CardexMovement[]>([])
  const [activeDrawer, setActiveDrawer] = React.useState<ActiveDrawer>(null)
  const [fefoHelpOpen, setFefoHelpOpen] = React.useState(false)
  const [quarantineOpen, setQuarantineOpen] = React.useState(false)
  const [selectedBatch, setSelectedBatch] = React.useState<DrugBatchRow | null>(
    null,
  )
  const [originKey, setOriginKey] = React.useState<string | null>(null)
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [addBatchForm, setAddBatchForm] =
    React.useState<AddBatchFormState>(EMPTY_ADD_BATCH)
  const [catalogForm, setCatalogForm] = React.useState<CatalogFormState | null>(
    null,
  )
  const [shelfForm, setShelfForm] = React.useState<ShelfFormState>({
    locationLabel: '',
  })

  const requestIdRef = React.useRef(0)
  const todayISO = React.useMemo(() => drugDetailsTodayISO(), [])
  const today = React.useMemo(() => parseTodayISO(todayISO), [todayISO])
  const closeDrawer = React.useCallback(
    (options?: { restore?: boolean }) => {
      const restore = options?.restore ?? true
      const key = originKey
      setActiveDrawer(null)
      setSelectedBatch(null)
      setFormErrors({})
      setSaving(false)
      if (restore) restoreOriginFocus(key)
    },
    [originKey],
  )

  const openDrawer = React.useCallback(
    (drawer: Exclude<ActiveDrawer, null>, key: string, batch?: DrugBatchRow) => {
      setOriginKey(key)
      setFormErrors({})
      setSelectedBatch(batch ?? null)
      if (drawer === 'add-batch') {
        setAddBatchForm({
          ...EMPTY_ADD_BATCH,
          supplierLabel: detail?.supplierName ?? '',
        })
      }
      if (drawer === 'edit-catalog' && detail) {
        setCatalogForm(catalogFormFromDetail(detail))
      }
      if (drawer === 'move-shelf' && batch) {
        setShelfForm({ locationLabel: batch.locationLabel })
      }
      setActiveDrawer(drawer)
    },
    [detail],
  )

  const openQuarantine = React.useCallback((batch: DrugBatchRow, key: string) => {
    setOriginKey(key)
    setSelectedBatch(batch)
    setQuarantineOpen(true)
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  React.useEffect(() => {
    const state: DrugDetailsUrlState = {
      drugId,
      tab,
      batchFilter,
      q: search,
      page,
      pageSize,
    }
    const params = serializeDrugDetailsUrlState(state)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [drugId, tab, batchFilter, search, page, pageSize, pathname, router])

  const load = React.useCallback(async (id: string) => {
    const requestId = ++requestIdRef.current
    if (!id) {
      setDetail(null)
      setBatches([])
      setMovements([])
      setLoadState('not-found')
      return
    }
    setLoadState('loading')
    try {
      const [nextDetail, nextBatches, nextMovements] = await Promise.all([
        fetchDrugDetail(id),
        fetchDrugBatches(id),
        fetchCardexMovements(id),
      ])
      if (requestId !== requestIdRef.current) return
      if (!nextDetail) {
        setDetail(null)
        setBatches([])
        setMovements([])
        setLoadState('not-found')
        return
      }
      setDetail(nextDetail)
      setBatches(nextBatches)
      setMovements(nextMovements)
      setLoadState('ready')
    } catch {
      if (requestId !== requestIdRef.current) return
      setLoadState('error')
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      await load(drugId)
    })()
    return () => {
      cancelled = true
    }
  }, [drugId, load])

  React.useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const parsed = parseDrugDetailsUrlState(
        new URLSearchParams(searchParams.toString()),
      )
      if (parsed.drugId !== drugId) setDrugId(parsed.drugId)
    })
    return () => {
      cancelled = true
    }
  }, [searchParams, drugId])

  async function handleAddBatchSubmit() {
    const result = validateAddBatch({
      batchNo: addBatchForm.batchNo,
      productionISO: addBatchForm.productionISO,
      expiryISO: addBatchForm.expiryISO,
      quantity: parseOptionalNumber(addBatchForm.quantity),
      buyPriceRial: parseOptionalNumber(addBatchForm.buyPriceRial),
      consumerPriceRial: parseOptionalNumber(addBatchForm.consumerPriceRial),
      locationLabel: addBatchForm.locationLabel,
      supplierLabel: addBatchForm.supplierLabel,
    })
    if (!result.ok) {
      setFormErrors(result.errors)
      focusFirstInvalid('add-batch', result.errors, [
        'batchNo',
        'productionISO',
        'expiryISO',
        'quantity',
        'buyPriceRial',
        'consumerPriceRial',
        'locationLabel',
        'supplierLabel',
      ])
      return
    }
    setSaving(true)
    setFormErrors({})
    try {
      await createDrugBatch({
        drugId,
        ...result.value,
        unitLabel: batches[0]?.unitLabel ?? 'جعبه',
      })
      const key = originKey
      toast.success('سری ساخت جدید با موفقیت ثبت شد.')
      closeDrawer({ restore: false })
      await load(drugId)
      restoreOriginFocus(key)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'ثبت سری ساخت ناموفق بود.',
      )
      setSaving(false)
    }
  }

  async function handleCatalogSubmit() {
    if (!catalogForm || !detail) return
    const result = validateCatalogEdit({
      nameFa: catalogForm.nameFa,
      brandName: catalogForm.brandName,
      manufacturer: catalogForm.manufacturer,
      atcCode: catalogForm.atcCode,
      gtin: catalogForm.gtin,
      dosageForm: catalogForm.dosageForm,
      strength: catalogForm.strength,
      reorderLevel: parseOptionalNumber(catalogForm.reorderLevel),
      isControlled: catalogForm.isControlled,
    })
    if (!result.ok) {
      setFormErrors(result.errors)
      focusFirstInvalid('edit-catalog', result.errors, [
        'nameFa',
        'brandName',
        'manufacturer',
        'atcCode',
        'gtin',
        'dosageForm',
        'strength',
        'reorderLevel',
      ])
      return
    }
    setSaving(true)
    setFormErrors({})
    try {
      const patch: CatalogEditInput = result.value
      await saveDrugCatalog(drugId, patch)
      const key = originKey
      toast.success('مشخصات کاتالوگ به‌روزرسانی شد.')
      closeDrawer({ restore: false })
      await load(drugId)
      restoreOriginFocus(key)
    } catch {
      toast.error('ویرایش کاتالوگ ناموفق بود.')
      setSaving(false)
    }
  }

  async function handleShelfMoveSubmit() {
    if (!selectedBatch) return
    const result = validateShelfMove({
      locationLabel: shelfForm.locationLabel,
    })
    if (!result.ok) {
      setFormErrors(result.errors)
      focusFirstInvalid('move-shelf', result.errors, ['locationLabel'])
      return
    }
    setSaving(true)
    setFormErrors({})
    try {
      await relocateDrugBatch(selectedBatch.id, result.value.locationLabel)
      const key = originKey
      toast.success('محل قفسه با موفقیت به‌روزرسانی شد.')
      closeDrawer({ restore: false })
      await load(drugId)
      restoreOriginFocus(key)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'جابجایی قفسه ناموفق بود.',
      )
      setSaving(false)
    }
  }

  async function handleQuarantineConfirm() {
    if (!selectedBatch) return
    setSaving(true)
    try {
      await quarantineDrugBatch(selectedBatch.id)
      setQuarantineOpen(false)
      toast.success(
        `سری ${selectedBatch.batchNo} به قرنطینه منتقل شد.`,
      )
      const key = originKey
      setSelectedBatch(null)
      await load(drugId)
      restoreOriginFocus(key)
    } catch {
      toast.error('انتقال به قرنطینه ناموفق بود.')
    } finally {
      setSaving(false)
    }
  }

  const batchQuery = React.useMemo(
    () =>
      applyBatchQuery(batches, {
        batchFilter,
        q: search,
        page: tab === 'batches' ? page : 1,
        pageSize: tab === 'batches' ? pageSize : Math.max(batches.length, 1),
        todayISO,
      }),
    [batches, batchFilter, search, page, pageSize, tab, todayISO],
  )

  const cardexRows = React.useMemo(
    () => buildCardexDisplay(movements),
    [movements],
  )

  function openPrintHtml(html: string) {
    // Omit noopener/noreferrer — those features make window.open return null,
    // so document.write/print would never run.
    const popup = window.open('', '_blank', 'width=960,height=720')
    if (!popup) {
      toast.error('پنجره چاپ مسدود شد. مسدودکننده پاپ‌آپ را بررسی کنید.')
      return
    }
    popup.document.write(html)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  function handleDownloadBatchesCsv() {
    const filteredRows = applyBatchQuery(batches, {
      batchFilter,
      q: search,
      page: 1,
      pageSize: Math.max(batches.length, 1),
      todayISO,
    }).rows
    const csv = buildBatchesCsv(filteredRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `batches-${drugId || 'drug'}.csv`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function handlePrintCardex() {
    if (!detail) return
    openPrintHtml(buildCardexPrintHtml({ nameFa: detail.nameFa }, cardexRows))
  }

  function handlePrintBarcode() {
    if (!detail) return
    const fefoBatch =
      batches.find((row) => batchQuery.fefoPriorityIds[0] === row.id) ??
      batches.find((row) => row.quantity > 0 && row.status === 'active')
    const locationHint = fefoBatch?.locationLabel ?? 'انبار مرکزی'
    openPrintHtml(
      buildBarcodeLabelHtml(
        {
          nameFa: detail.nameFa,
          gtin: detail.gtin,
          brandName: detail.brandName,
        },
        locationHint,
      ),
    )
  }

  const cardexPageCount = Math.max(1, Math.ceil(cardexRows.length / pageSize))
  const cardexPageRows = React.useMemo(() => {
    if (tab !== 'cardex') return cardexRows
    const start = (page - 1) * pageSize
    return cardexRows.slice(start, start + pageSize)
  }, [cardexRows, tab, page, pageSize])

  const timelineItems = React.useMemo((): KardexTimelineItem[] => {
    return cardexRows.slice(0, 8).map((m) => ({
      id: m.id,
      title: `${MOVEMENT_TYPE_LABELS[m.type]} · ${m.batchNo}`,
      description: m.note,
      timestamp: `${formatJalaliDate(m.timestampISO)}، ${formatPersianTime(m.timestampISO)}`,
      meta: `${m.actorName} · شیفت ${m.shiftLabel}`,
      tone: movementTone(m.type),
      icon: movementIcon(m.type),
      deltaIn:
        m.qtyIn > 0 ? `+${formatPersianNumber(m.qtyIn)}` : undefined,
      deltaOut:
        m.qtyOut > 0 ? `−${formatPersianNumber(m.qtyOut)}` : undefined,
      balance: formatPersianNumber(m.balance),
    }))
  }, [cardexRows])

  const unitLabel = batches[0]?.unitLabel ?? 'جعبه'
  const inventoryValue = batches.reduce(
    (sum, row) => sum + row.buyPriceRial * row.quantity,
    0,
  )
  const weightedAvgBuy =
    batchQuery.kpis.totalQty > 0
      ? Math.round(inventoryValue / batchQuery.kpis.totalQty)
      : 0
  const avgMargin =
    batches.length > 0
      ? Math.round(
          batches.reduce(
            (sum, row) =>
              sum + marginPercent(row.buyPriceRial, row.consumerPriceRial),
            0,
          ) / batches.length,
        )
      : 0

  const chipCounts = React.useMemo(
    () => ({
      all: filterCount(batches, 'all', todayISO),
      'in-stock': filterCount(batches, 'in-stock', todayISO),
      expiring: filterCount(batches, 'expiring', todayISO),
      quarantine: filterCount(batches, 'quarantine', todayISO),
    }),
    [batches, todayISO],
  )

  const batchColumns = React.useMemo((): DenseColumn<DrugBatchRow>[] => {
    const totalQty = Math.max(batchQuery.kpis.totalQty, 1)
    return [
      {
        id: 'batchNo',
        header: 'شماره سری ساخت',
        cell: (row) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-latin font-semibold tabular-nums-data" dir="ltr">
              {row.batchNo}
            </span>
            <span className="text-label-sm text-text-muted">
              ({row.supplierLabel})
            </span>
          </div>
        ),
      },
      {
        id: 'production',
        header: 'تاریخ تولید',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <span className="tabular-nums-data">
            {formatJalaliDate(row.productionISO)}
          </span>
        ),
      },
      {
        id: 'expiry',
        header: 'تاریخ انقضا (شمسی)',
        cell: (row) => {
          const days = daysUntilExpiry(row.expiryISO, today)
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold tabular-nums-data text-secondary">
                {formatJalaliDate(row.expiryISO)}
              </span>
              <span className="text-label-sm text-text-muted">
                {remainingMonthsLabel(days)}
              </span>
            </div>
          )
        },
      },
      {
        id: 'buy',
        header: 'قیمت خرید (ریال)',
        align: 'end',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <span className="tabular-nums-data">
            {formatRial(row.buyPriceRial, { withCurrency: false })}
          </span>
        ),
      },
      {
        id: 'consumer',
        header: 'قیمت مصرف‌کننده',
        align: 'end',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <span className="font-semibold tabular-nums-data text-primary">
            {formatRial(row.consumerPriceRial, { withCurrency: false })}
          </span>
        ),
      },
      {
        id: 'margin',
        header: 'حاشیه سود',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <Badge variant="neutral" className="tabular-nums-data">
            {formatPersianNumber(
              Math.round(marginPercent(row.buyPriceRial, row.consumerPriceRial)),
            )}
            ٪
          </Badge>
        ),
      },
      {
        id: 'qty',
        header: 'موجودی فیزیکی',
        cell: (row) => {
          const pct = Math.round((row.quantity / totalQty) * 100)
          return (
            <div className="min-w-[8rem] space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-body-sm">
                <span className="font-semibold tabular-nums-data">
                  {formatPersianNumber(row.quantity)} {row.unitLabel}
                </span>
                <span className="text-label-sm text-text-muted tabular-nums-data">
                  {formatPersianNumber(pct)}٪ کل
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          )
        },
      },
      {
        id: 'location',
        header: 'محل در انبار',
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        cell: (row) => (
          <Badge variant="neutral" className="font-medium">
            {row.locationLabel}
          </Badge>
        ),
      },
      {
        id: 'fefo',
        header: 'وضعیت FEFO',
        cell: (row) => {
          const badge = fefoBadge(row, batchQuery.fefoPriorityIds, today)
          return (
            <TriageStatusBadge status={badge.status}>
              {badge.label}
            </TriageStatusBadge>
          )
        },
      },
      {
        id: 'actions',
        header: 'عملیات',
        cell: (row) => (
          <div className="flex items-center justify-center gap-1">
            <ActionTooltip title="مشاهده فاکتور ورود">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="مشاهده فاکتور ورود"
                data-origin={`invoice-${row.id}`}
                onClick={() =>
                  openDrawer('view-invoice', `invoice-${row.id}`, row)
                }
              >
                <Icon name="receipt" size={18} data-slot="icon" />
              </Button>
            </ActionTooltip>
            <ActionTooltip title="جابجایی قفسه / پالت">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="جابجایی قفسه / پالت"
                data-origin={`move-${row.id}`}
                onClick={() =>
                  openDrawer('move-shelf', `move-${row.id}`, row)
                }
              >
                <Icon name="swap_horiz" size={18} data-slot="icon" />
              </Button>
            </ActionTooltip>
            {row.status === 'quarantine' || row.status === 'blocked' ? null : (
              <ActionTooltip title="انتقال به قرنطینه">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="انتقال به قرنطینه"
                  data-origin={`quarantine-${row.id}`}
                  onClick={() =>
                    openQuarantine(row, `quarantine-${row.id}`)
                  }
                >
                  <Icon name="block" size={18} data-slot="icon" />
                </Button>
              </ActionTooltip>
            )}
          </div>
        ),
      },
    ]
  }, [
    batchQuery.fefoPriorityIds,
    batchQuery.kpis.totalQty,
    openDrawer,
    openQuarantine,
    today,
  ])

  const cardexColumns = React.useMemo((): DenseColumn<
    CardexMovement & { balance: number }
  >[] => {
    return [
      {
        id: 'type',
        header: 'نوع سند / شماره مرجع',
        cell: (row) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-inner bg-surface-muted text-text-secondary">
              <Icon name={movementIcon(row.type) as 'sync_alt'} size={16} />
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-text-primary">
                {MOVEMENT_TYPE_LABELS[row.type]}
              </div>
              <div className="text-label-sm text-text-muted line-clamp-1">
                {row.note}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'time',
        header: 'زمان و تاریخ ثبت',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <span className="tabular-nums-data text-text-secondary">
            {formatJalaliDate(row.timestampISO)}،{' '}
            {formatPersianTime(row.timestampISO)}
          </span>
        ),
      },
      {
        id: 'batch',
        header: 'سری ساخت (بچ)',
        cell: (row) => (
          <span className="font-latin font-bold tabular-nums-data" dir="ltr">
            {row.batchNo}
          </span>
        ),
      },
      {
        id: 'in',
        header: 'ورود (+)',
        cell: (row) =>
          row.qtyIn > 0 ? (
            <span className="font-bold tabular-nums-data text-secondary">
              +{formatPersianNumber(row.qtyIn)}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          ),
      },
      {
        id: 'out',
        header: 'خروج (−)',
        cell: (row) =>
          row.qtyOut > 0 ? (
            <span className="font-bold tabular-nums-data text-status-critical-fg">
              {formatPersianNumber(row.qtyOut)}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          ),
      },
      {
        id: 'balance',
        header: 'مانده نهایی انبار',
        cell: (row) => (
          <span className="font-bold tabular-nums-data">
            {formatPersianNumber(row.balance)} {unitLabel}
          </span>
        ),
      },
      {
        id: 'actor',
        header: 'کاربر ثبت‌کننده / شیفت',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <span>
            {row.actorName} ({row.shiftLabel})
          </span>
        ),
      },
      {
        id: 'note',
        header: 'توضیحات و مستندات',
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        cell: (row) => (
          <span className="text-label-sm text-text-muted">{row.note}</span>
        ),
      },
    ]
  }, [unitLabel])

  const headingTitle = detail
    ? `جزئیات فرآورده: ${detail.nameFa}`
    : 'جزئیات دارو و کاردکس'

  const drawerTitle =
    activeDrawer === 'add-batch'
      ? 'ثبت ورود سری ساخت (بچ) جدید'
      : activeDrawer === 'edit-catalog'
        ? 'ویرایش کاتالوگ'
        : activeDrawer === 'move-shelf'
          ? 'جابجایی قفسه / پالت'
          : activeDrawer === 'view-invoice'
            ? 'مشاهده فاکتور ورود'
            : ''

  const drawerDescription =
    activeDrawer === 'add-batch'
      ? 'ثبت ورود فیزیکی سری ساخت جدید به انبار'
      : activeDrawer === 'edit-catalog'
        ? 'به‌روزرسانی مشخصات کاتالوگ در نشست فعلی'
        : activeDrawer === 'move-shelf'
          ? 'تغییر محل قفسه / پالت برای سری ساخت انتخاب‌شده'
          : activeDrawer === 'view-invoice'
            ? 'خلاصه فاکتور ورود مرتبط با سری ساخت'
            : undefined

  return (
    <AppShell
      navItems={getDrugDetailsNavItems('catalog')}
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
        title={headingTitle}
        description="پروفایل دارو، سری‌های ساخت فعال و کاردکس انبار"
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">مدیریت داروخانه</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/drug-catalog">کاتالوگ دارو</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{headingTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        actions={
          <>
            <Link
              href="/drug-catalog"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-default border border-border-default bg-surface px-4 py-2 text-body-md font-medium text-text-primary whitespace-nowrap outline-none transition-[color,background-color,border-color,box-shadow,opacity] hover:border-border-strong hover:bg-surface-hover focus-visible:border-primary focus-visible:shadow-focus"
            >
              <Icon name="arrow_forward" size={18} data-slot="icon" />
              بازگشت به لیست کاتالوگ دارو
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="راهنما و پروتکل FEFO"
              aria-label="راهنما و پروتکل FEFO"
              onClick={() => setFefoHelpOpen(true)}
            >
              <Icon name="help_outline" size={20} data-slot="icon" />
            </Button>
          </>
        }
      />

      {loadState === 'not-found' ? (
        <AlertBanner
          tone="warning"
          title="دارو یافت نشد"
          description={
            drugId
              ? 'شناسه دارو در کاتالوگ موجود نیست یا نامعتبر است.'
              : 'برای مشاهده جزئیات، دارو را از کاتالوگ انتخاب کنید.'
          }
          action={
            <Button type="button" variant="outline" asChild>
              <Link href="/drug-catalog">بازگشت به کاتالوگ دارو</Link>
            </Button>
          }
        />
      ) : null}

      {loadState === 'error' ? (
        <AlertBanner
          tone="critical"
          title="خطا در بارگذاری جزئیات دارو"
          description="دریافت پروفایل، بچ‌ها یا کاردکس ناموفق بود."
          action={
            <Button type="button" onClick={() => void load(drugId)}>
              تلاش مجدد
            </Button>
          }
        />
      ) : null}

      {loadState === 'loading' ? (
        <div
          data-slot="drug-details-skeleton"
          className="flex flex-col gap-3 rounded-default border border-border-default bg-surface p-5"
          aria-busy="true"
          aria-label="در حال بارگذاری"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-inner bg-surface-muted"
            />
          ))}
        </div>
      ) : null}

      {loadState === 'ready' && detail ? (
        <>
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="inline-flex size-20 shrink-0 items-center justify-center rounded-default bg-secondary-tint text-primary">
                  <Icon name="medication" size={44} data-slot="icon" />
                </span>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{detail.rxLabel}</Badge>
                    {detail.atcCode ? (
                      <Badge variant="neutral" className="font-latin" dir="ltr">
                        ATC: {detail.atcCode}
                      </Badge>
                    ) : null}
                    {detail.fefoEnabled ? (
                      <Badge variant="valid" className="gap-1">
                        <span
                          className="size-1.5 rounded-full bg-status-valid-fg"
                          aria-hidden
                        />
                        پروتکل ترخیص: FEFO فعال
                      </Badge>
                    ) : null}
                  </div>
                  <h2 className="text-headline-lg text-text-primary">
                    {detail.nameFa}
                  </h2>
                  <p
                    className="font-latin text-label-md text-text-muted"
                    dir="ltr"
                  >
                    {detail.nameEn}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="verified" size={16} className="text-primary" />
                      نام تجاری:{' '}
                      <strong className="text-text-primary">
                        {detail.brandName}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon
                        name="warehouse"
                        size={16}
                        className="text-text-muted"
                      />
                      {detail.manufacturer}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 xl:w-auto xl:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    data-origin="add-batch"
                    onClick={() => openDrawer('add-batch', 'add-batch')}
                  >
                    <Icon name="add_box" size={18} data-slot="icon" />
                    ثبت ورود سری ساخت (بچ) جدید
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    title="چاپ بارکد قفسه"
                    aria-label="چاپ بارکد قفسه"
                    onClick={handlePrintBarcode}
                  >
                    <Icon name="print" size={20} data-slot="icon" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    title="ویرایش کاتالوگ"
                    aria-label="ویرایش کاتالوگ"
                    data-origin="edit-catalog"
                    onClick={() => openDrawer('edit-catalog', 'edit-catalog')}
                  >
                    <Icon name="edit" size={20} data-slot="icon" />
                  </Button>
                </div>
                <p className="text-label-sm text-text-muted">
                  آخرین به‌روزرسانی مشخصات: امروز (نشست فعلی)
                </p>
              </div>
            </CardContent>
            <div className="flex flex-wrap items-center gap-4 border-t border-border-subtle bg-surface-subtle px-5 py-3 text-label-md text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="barcode" size={16} className="text-text-muted" />
                کد IRC:
                <strong
                  className="font-latin tabular-nums-data text-text-primary"
                  dir="ltr"
                >
                  {toPersianDigits(detail.irc)}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="qr_code_2" size={16} className="text-text-muted" />
                کد GTIN:
                <strong
                  className="font-latin tabular-nums-data text-text-primary"
                  dir="ltr"
                >
                  {toPersianDigits(detail.gtin)}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="thermostat" size={16} className="text-text-muted" />
                شرایط نگهداری:
                <span className="text-text-primary">{detail.storageLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="shield" size={16} className="text-text-muted" />
                طبقه قانونی:
                <span className="text-text-primary">
                  {detail.legalClassLabel}
                </span>
              </span>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiMetricCard
              title="موجودی فیزیکی قابل ترخیص"
              value={
                <span className="tabular-nums-data">
                  {formatPersianNumber(batchQuery.kpis.dispensableQty)}
                </span>
              }
              description={`${unitLabel} · ROP: ${formatPersianNumber(detail.reorderLevel)}`}
              icon="inventory_2"
              tone="primary"
              delta={{
                label: `جمع کل: ${formatPersianNumber(batchQuery.kpis.totalQty)}`,
                direction: 'flat',
              }}
            />
            <KpiMetricCard
              title="ارزش ریالی سرمایه در گردش"
              value={
                <span className="tabular-nums-data">
                  {formatRial(inventoryValue, { withCurrency: false })}
                </span>
              }
              description="ریال"
              icon="account_balance_wallet"
              tone="info"
              delta={{
                label: `میانگین خرید: ${formatRial(weightedAvgBuy)}`,
                direction: 'flat',
              }}
            />
            <KpiMetricCard
              title="تعداد سری‌های ساخت فعال"
              value={
                <span className="tabular-nums-data">
                  {formatPersianNumber(batchQuery.kpis.activeBatchCount)}
                </span>
              }
              description="سری ساخت (بچ فعال)"
              icon="layers"
              tone="neutral"
              delta={{
                label: `قرنطینه: ${formatPersianNumber(batchQuery.kpis.quarantineBatchCount)} · حاشیه ≈ ${formatPersianNumber(avgMargin)}٪`,
                direction: 'flat',
              }}
            />
            <KpiMetricCard
              title="نزدیک‌ترین موعد انقضا (FEFO)"
              value={
                <span className="tabular-nums-data text-secondary">
                  {batchQuery.kpis.fefoExpiryISO
                    ? formatJalaliDate(batchQuery.kpis.fefoExpiryISO)
                    : '—'}
                </span>
              }
              description={
                batchQuery.kpis.fefoBatchNo
                  ? `بچ ${batchQuery.kpis.fefoBatchNo}`
                  : 'بدون اولویت FEFO'
              }
              icon="event_available"
              tone="valid"
              delta={{
                label: batchQuery.kpis.fefoExpiryISO
                  ? remainingMonthsLabel(
                      daysUntilExpiry(batchQuery.kpis.fefoExpiryISO, today),
                    )
                  : 'نامشخص',
                direction: 'flat',
              }}
            />
          </div>

          <Tabs
            dir="rtl"
            value={tab}
            onValueChange={(value) => {
              setTab(value as DrugDetailsTab)
              setPage(1)
            }}
            className="gap-4"
          >
            <TabsList className="ml-auto h-auto w-full flex-col items-stretch justify-start gap-1 rounded-default p-1 sm:w-fit sm:flex-row sm:flex-wrap sm:items-center">
              <TabsTrigger
                value="batches"
                aria-label="بچ‌ها و سری‌های ساخت فعال"
                className="h-auto w-full flex-none justify-start gap-2 whitespace-normal rounded-inner text-start sm:w-auto sm:max-w-full"
              >
                <Icon name="format_list_numbered" size={18} data-slot="icon" />
                <span className="min-w-0 flex-1 text-balance" aria-hidden="true">
                  <span className="sm:hidden">بچ‌ها و سری ساخت</span>
                  <span className="hidden sm:inline">
                    بچ‌ها و سری‌های ساخت فعال
                  </span>
                </span>
                <Badge variant="secondary" className="shrink-0 tabular-nums-data">
                  {formatPersianNumber(batches.length)} سری
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="cardex"
                aria-label="گردش موجودی و کاردکس انبار"
                className="h-auto w-full flex-none justify-start gap-2 whitespace-normal rounded-inner text-start sm:w-auto sm:max-w-full"
              >
                <Icon name="sync_alt" size={18} data-slot="icon" />
                <span className="min-w-0 flex-1 text-balance" aria-hidden="true">
                  <span className="sm:hidden">کاردکس انبار</span>
                  <span className="hidden sm:inline">
                    گردش موجودی و کاردکس انبار
                  </span>
                </span>
                <Badge variant="neutral" className="shrink-0 tabular-nums-data">
                  {formatPersianNumber(movements.length)} تراکنش
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="info"
                aria-label="اطلاعات فرآورده و شناسنامه بالینی"
                className="h-auto w-full flex-none justify-start gap-2 whitespace-normal rounded-inner text-start sm:w-auto sm:max-w-full"
              >
                <Icon name="clinical_notes" size={18} data-slot="icon" />
                <span className="min-w-0 flex-1 text-balance" aria-hidden="true">
                  <span className="sm:hidden">شناسنامه فرآورده</span>
                  <span className="hidden sm:inline">
                    اطلاعات فرآورده و شناسنامه بالینی
                  </span>
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="batches" className="space-y-3">
              <div className="flex flex-col gap-3 rounded-default border border-border-default bg-surface p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-label-lg font-bold text-text-primary">
                    فیلتر سریع سری‌ها:
                  </span>
                  {(Object.keys(BATCH_FILTER_LABELS) as BatchFilter[]).map(
                    (filter) => {
                      const active = batchFilter === filter
                      return (
                        <Button
                          key={filter}
                          type="button"
                          size="sm"
                          variant={active ? 'default' : 'secondary'}
                          onClick={() => {
                            setBatchFilter(filter)
                            setPage(1)
                          }}
                        >
                          {BATCH_FILTER_LABELS[filter]} (
                          {formatPersianNumber(chipCounts[filter])})
                        </Button>
                      )
                    },
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative min-w-[12rem] flex-1 sm:w-64 sm:flex-none">
                    <Input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="جستجوی شماره سری یا پالت..."
                      aria-label="جستجوی شماره سری ساخت"
                      className="pe-9"
                    />
                    <Icon
                      name="search"
                      size={16}
                      className="pointer-events-none absolute end-2.5 top-2.5 text-text-muted"
                      data-slot="icon"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    title="دریافت خروجی اکسل کاردکس بچ‌ها"
                    aria-label="خروجی اکسل بچ‌ها"
                    onClick={handleDownloadBatchesCsv}
                  >
                    <Icon name="download" size={20} data-slot="icon" />
                  </Button>
                </div>
              </div>

              {batchQuery.total === 0 ? (
                <AlertBanner
                  tone="info"
                  title={
                    batches.length === 0
                      ? 'سری ساختی ثبت نشده است'
                      : 'نتیجه‌ای برای فیلتر/جستجو یافت نشد'
                  }
                  description={
                    batches.length === 0
                      ? 'برای این دارو هنوز بچ فعالی در انبار ثبت نشده است.'
                      : 'فیلتر یا عبارت جستجو را تغییر دهید.'
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-default border border-border-default bg-surface">
                  <DenseDataTable
                    columns={batchColumns}
                    data={batchQuery.rows}
                    getRowId={(row) => row.id}
                    caption="جدول سری‌های ساخت دارو"
                    emptyMessage="موردی برای نمایش وجود ندارد"
                    maxHeight="min(36rem, 60vh)"
                  />
                  <div className="flex flex-col gap-2 border-t border-border-subtle bg-surface-subtle px-4 py-3 text-body-sm text-text-secondary md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-4">
                      <span>
                        مجموع بچ‌های محاسبه شده:{' '}
                        <strong className="tabular-nums-data text-text-primary">
                          {formatPersianNumber(batchQuery.total)} سری
                        </strong>
                      </span>
                      <span>
                        جمع کل موجودی عددی:{' '}
                        <strong className="tabular-nums-data text-text-primary">
                          {formatPersianNumber(batchQuery.kpis.totalQty)}{' '}
                          {unitLabel}
                        </strong>
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-label-sm text-text-muted">
                      <Icon
                        name="check_circle"
                        size={16}
                        className="text-secondary"
                      />
                      ترتیب خروج بر اساس FEFO اولویت‌بندی شده است.
                    </span>
                  </div>
                  <Pagination
                    page={page}
                    pageCount={Math.max(
                      1,
                      Math.ceil(batchQuery.total / pageSize),
                    )}
                    totalItems={batchQuery.total}
                    pageSize={pageSize}
                    pageSizeOptions={[...DRUG_DETAILS_PAGE_SIZES]}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size)
                      setPage(1)
                    }}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="cardex" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-headline-sm">
                      کاردکس انبار و ثبت رویدادهای فیزیکی
                    </CardTitle>
                    <p className="mt-1 text-body-sm text-text-muted">
                      ثبت خودکار کلیه اسناد ورود، خروج، حواله و اصلاحات
                      انبارگردانی
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" disabled>
                      <Icon name="tune" size={18} data-slot="icon" />
                      فیلتر بازه زمانی
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handlePrintCardex}
                    >
                      <Icon name="print" size={18} data-slot="icon" />
                      پرینت کاردکس رسمی
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <KardexTimeline
                    items={timelineItems}
                    emptyLabel="رویدادی در کاردکس ثبت نشده است"
                  />
                  {cardexRows.length === 0 ? (
                    <AlertBanner
                      tone="info"
                      title="کاردکس خالی است"
                      description="هنوز حرکت موجودی برای این دارو ثبت نشده است."
                    />
                  ) : (
                    <div className="overflow-hidden rounded-default border border-border-default">
                      <DenseDataTable
                        columns={cardexColumns}
                        data={cardexPageRows}
                        getRowId={(row) => row.id}
                        caption="جدول حرکات کاردکس"
                        maxHeight="min(32rem, 55vh)"
                      />
                      <Pagination
                        page={page}
                        pageCount={cardexPageCount}
                        totalItems={cardexRows.length}
                        pageSize={pageSize}
                        pageSizeOptions={[...DRUG_DETAILS_PAGE_SIZES]}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => {
                          setPageSize(size)
                          setPage(1)
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="info" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader className="flex-row items-center gap-2 space-y-0 border-b border-border-subtle pb-3">
                    <Icon name="science" size={24} className="text-primary" />
                    <CardTitle className="text-headline-sm">
                      شناسنامه داروشناسی و فرمولاسیون
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2">
                    <div className="space-y-1 rounded-inner bg-surface-subtle p-3">
                      <span className="text-label-sm text-text-muted">
                        شکل و فرم دارویی
                      </span>
                      <div className="text-title-md font-semibold">
                        {detail.dosageForm}
                      </div>
                    </div>
                    <div className="space-y-1 rounded-inner bg-surface-subtle p-3">
                      <span className="text-label-sm text-text-muted">
                        قدرت و دوز مؤثر ماده مؤثره
                      </span>
                      <div className="text-title-md font-semibold tabular-nums-data">
                        {detail.strength}
                      </div>
                    </div>
                    <div className="space-y-1 rounded-inner bg-surface-subtle p-3 sm:col-span-2">
                      <span className="text-label-sm text-text-muted">
                        پروتکل فارماکوپه و نگهداری استاندارد
                      </span>
                      <p className="mt-1 text-body-md text-text-primary">
                        {detail.storageLabel}
                      </p>
                    </div>
                    <div className="space-y-2 border-t border-border-subtle pt-3 sm:col-span-2">
                      <span className="text-label-lg font-bold text-text-primary">
                        ملاحظات توزیع و بالینی داروخانه:
                      </span>
                      <ul className="list-inside list-disc space-y-1 text-body-sm text-text-secondary">
                        {detail.clinicalNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card className="flex flex-col justify-between">
                  <div>
                    <CardHeader className="flex-row items-center gap-2 space-y-0 border-b border-border-subtle pb-3">
                      <Icon name="warehouse" size={24} className="text-secondary" />
                      <CardTitle className="text-headline-sm">
                        پارامترهای لجستیک و انبار
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-center justify-between rounded-inner bg-surface-subtle p-3">
                        <span className="text-label-md text-text-secondary">
                          نقطه سفارش مجدد (ROP):
                        </span>
                        <span className="font-bold tabular-nums-data">
                          {formatPersianNumber(detail.reorderLevel)} {unitLabel}
                        </span>
                      </div>
                      {detail.logisticsNotes.map((note) => (
                        <div
                          key={note}
                          className="rounded-inner bg-surface-subtle p-3 text-body-sm text-text-secondary"
                        >
                          {note}
                        </div>
                      ))}
                      <div className="rounded-default bg-surface-muted p-3">
                        <span className="text-label-sm font-bold text-text-muted">
                          توزیع‌کننده انحصاری فعال:
                        </span>
                        <div className="mt-1 text-label-lg font-bold text-text-primary">
                          {detail.supplierName}
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <SideDrawer
        open={activeDrawer !== null}
        onOpenChange={(open) => {
          if (!open) closeDrawer()
        }}
        title={drawerTitle}
        description={drawerDescription}
        footer={
          activeDrawer === 'view-invoice' ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => closeDrawer()}>
                بستن
              </Button>
            </div>
          ) : activeDrawer === 'add-batch' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => closeDrawer()}
              >
                انصراف
              </Button>
              <Button
                type="button"
                loading={saving}
                onClick={() => void handleAddBatchSubmit()}
              >
                ثبت سری ساخت
              </Button>
            </div>
          ) : activeDrawer === 'edit-catalog' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => closeDrawer()}
              >
                انصراف
              </Button>
              <Button
                type="button"
                loading={saving}
                onClick={() => void handleCatalogSubmit()}
              >
                ذخیره تغییرات
              </Button>
            </div>
          ) : activeDrawer === 'move-shelf' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => closeDrawer()}
              >
                انصراف
              </Button>
              <Button
                type="button"
                loading={saving}
                onClick={() => void handleShelfMoveSubmit()}
              >
                تأیید جابجایی
              </Button>
            </div>
          ) : null
        }
      >
        {activeDrawer === 'add-batch' ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void handleAddBatchSubmit()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="add-batch-batchNo">شماره سری ساخت</Label>
              <Input
                id="add-batch-batchNo"
                value={addBatchForm.batchNo}
                dir="ltr"
                className="font-latin"
                aria-invalid={Boolean(formErrors.batchNo)}
                onChange={(event) =>
                  setAddBatchForm((prev) => ({
                    ...prev,
                    batchNo: event.target.value,
                  }))
                }
              />
              <FieldError message={formErrors.batchNo} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-batch-productionISO">تاریخ تولید</Label>
                <DatePicker
                  id="add-batch-productionISO"
                  value={addBatchForm.productionISO}
                  aria-invalid={Boolean(formErrors.productionISO)}
                  placeholder="انتخاب تاریخ تولید"
                  onChange={(productionISO) =>
                    setAddBatchForm((prev) => ({
                      ...prev,
                      productionISO,
                    }))
                  }
                />
                <FieldError message={formErrors.productionISO} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-batch-expiryISO">تاریخ انقضا</Label>
                <DatePicker
                  id="add-batch-expiryISO"
                  value={addBatchForm.expiryISO}
                  aria-invalid={Boolean(formErrors.expiryISO)}
                  placeholder="انتخاب تاریخ انقضا"
                  onChange={(expiryISO) =>
                    setAddBatchForm((prev) => ({
                      ...prev,
                      expiryISO,
                    }))
                  }
                />
                <FieldError message={formErrors.expiryISO} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-batch-quantity">موجودی فیزیکی</Label>
              <Input
                id="add-batch-quantity"
                type="number"
                min={1}
                inputMode="numeric"
                value={addBatchForm.quantity}
                aria-invalid={Boolean(formErrors.quantity)}
                onChange={(event) =>
                  setAddBatchForm((prev) => ({
                    ...prev,
                    quantity: event.target.value,
                  }))
                }
              />
              <FieldError message={formErrors.quantity} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-batch-buyPriceRial">قیمت خرید (ریال)</Label>
                <Input
                  id="add-batch-buyPriceRial"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={addBatchForm.buyPriceRial}
                  aria-invalid={Boolean(formErrors.buyPriceRial)}
                  onChange={(event) =>
                    setAddBatchForm((prev) => ({
                      ...prev,
                      buyPriceRial: event.target.value,
                    }))
                  }
                />
                <FieldError message={formErrors.buyPriceRial} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-batch-consumerPriceRial">
                  قیمت مصرف‌کننده
                </Label>
                <Input
                  id="add-batch-consumerPriceRial"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={addBatchForm.consumerPriceRial}
                  aria-invalid={Boolean(formErrors.consumerPriceRial)}
                  onChange={(event) =>
                    setAddBatchForm((prev) => ({
                      ...prev,
                      consumerPriceRial: event.target.value,
                    }))
                  }
                />
                <FieldError message={formErrors.consumerPriceRial} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-batch-locationLabel">محل نگهداری</Label>
              <Input
                id="add-batch-locationLabel"
                value={addBatchForm.locationLabel}
                placeholder="مثال: قفسه A-12 / پالت ۳"
                aria-invalid={Boolean(formErrors.locationLabel)}
                onChange={(event) =>
                  setAddBatchForm((prev) => ({
                    ...prev,
                    locationLabel: event.target.value,
                  }))
                }
              />
              <FieldError message={formErrors.locationLabel} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-batch-supplierLabel">تأمین‌کننده</Label>
              <Input
                id="add-batch-supplierLabel"
                value={addBatchForm.supplierLabel}
                onChange={(event) =>
                  setAddBatchForm((prev) => ({
                    ...prev,
                    supplierLabel: event.target.value,
                  }))
                }
              />
              <FieldError message={formErrors.supplierLabel} />
            </div>
          </form>
        ) : null}

        {activeDrawer === 'edit-catalog' && catalogForm ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCatalogSubmit()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-catalog-nameFa">نام فارسی دارو</Label>
              <Input
                id="edit-catalog-nameFa"
                value={catalogForm.nameFa}
                aria-invalid={Boolean(formErrors.nameFa)}
                onChange={(event) =>
                  setCatalogForm((prev) =>
                    prev ? { ...prev, nameFa: event.target.value } : prev,
                  )
                }
              />
              <FieldError message={formErrors.nameFa} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-catalog-brandName">نام تجاری</Label>
                <Input
                  id="edit-catalog-brandName"
                  value={catalogForm.brandName}
                  onChange={(event) =>
                    setCatalogForm((prev) =>
                      prev ? { ...prev, brandName: event.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-catalog-manufacturer">سازنده</Label>
                <Input
                  id="edit-catalog-manufacturer"
                  value={catalogForm.manufacturer}
                  onChange={(event) =>
                    setCatalogForm((prev) =>
                      prev
                        ? { ...prev, manufacturer: event.target.value }
                        : prev,
                    )
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-catalog-atcCode">کد ATC</Label>
                <Input
                  id="edit-catalog-atcCode"
                  value={catalogForm.atcCode}
                  dir="ltr"
                  className="font-latin"
                  onChange={(event) =>
                    setCatalogForm((prev) =>
                      prev ? { ...prev, atcCode: event.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-catalog-gtin">کد GTIN</Label>
                <Input
                  id="edit-catalog-gtin"
                  value={catalogForm.gtin}
                  dir="ltr"
                  className="font-latin"
                  onChange={(event) =>
                    setCatalogForm((prev) =>
                      prev ? { ...prev, gtin: event.target.value } : prev,
                    )
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-catalog-dosageForm">شکل دارویی</Label>
                <Input
                  id="edit-catalog-dosageForm"
                  value={catalogForm.dosageForm}
                  onChange={(event) =>
                    setCatalogForm((prev) =>
                      prev
                        ? { ...prev, dosageForm: event.target.value }
                        : prev,
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-catalog-strength">قدرت / دوز</Label>
                <Input
                  id="edit-catalog-strength"
                  value={catalogForm.strength}
                  onChange={(event) =>
                    setCatalogForm((prev) =>
                      prev ? { ...prev, strength: event.target.value } : prev,
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-catalog-reorderLevel">
                نقطه سفارش مجدد (ROP)
              </Label>
              <Input
                id="edit-catalog-reorderLevel"
                type="number"
                min={0}
                inputMode="numeric"
                value={catalogForm.reorderLevel}
                aria-invalid={Boolean(formErrors.reorderLevel)}
                onChange={(event) =>
                  setCatalogForm((prev) =>
                    prev
                      ? { ...prev, reorderLevel: event.target.value }
                      : prev,
                  )
                }
              />
              <FieldError message={formErrors.reorderLevel} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <Checkbox
                checked={catalogForm.isControlled}
                onCheckedChange={(checked) =>
                  setCatalogForm((prev) =>
                    prev
                      ? { ...prev, isControlled: checked === true }
                      : prev,
                  )
                }
                aria-label="داروی تحت کنترل"
              />
              <span className="text-label-md text-text-secondary">
                داروی تحت کنترل
              </span>
            </label>
          </form>
        ) : null}

        {activeDrawer === 'move-shelf' ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void handleShelfMoveSubmit()
            }}
          >
            {selectedBatch ? (
              <p className="text-body-sm text-text-secondary">
                سری ساخت:{' '}
                <strong className="font-latin" dir="ltr">
                  {selectedBatch.batchNo}
                </strong>
                {' · '}
                محل فعلی: {selectedBatch.locationLabel}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="move-shelf-locationLabel">محل قفسه / پالت</Label>
              <Input
                id="move-shelf-locationLabel"
                value={shelfForm.locationLabel}
                aria-invalid={Boolean(formErrors.locationLabel)}
                onChange={(event) =>
                  setShelfForm({ locationLabel: event.target.value })
                }
              />
              <FieldError message={formErrors.locationLabel} />
            </div>
          </form>
        ) : null}

        {activeDrawer === 'view-invoice' ? (
          selectedBatch?.invoiceNo ? (
            <div className="space-y-3 rounded-default bg-surface-subtle p-4">
              <div>
                <div className="text-label-sm text-text-muted">شماره فاکتور ورود</div>
                <div
                  className="mt-1 font-latin text-title-md font-semibold tabular-nums-data"
                  dir="ltr"
                >
                  {selectedBatch.invoiceNo}
                </div>
              </div>
              <div>
                <div className="text-label-sm text-text-muted">تأمین‌کننده</div>
                <div className="mt-1 text-body-md text-text-primary">
                  {selectedBatch.supplierLabel || '—'}
                </div>
              </div>
              <div>
                <div className="text-label-sm text-text-muted">سری ساخت</div>
                <div
                  className="mt-1 font-latin text-body-md tabular-nums-data"
                  dir="ltr"
                >
                  {selectedBatch.batchNo}
                </div>
              </div>
            </div>
          ) : (
            <AlertBanner
              tone="info"
              title="فاکتور ورودی موجود نیست"
              description="برای این سری ساخت، شماره فاکتور ورود در داده‌های نشست ثبت نشده است."
            />
          )
        ) : null}
      </SideDrawer>

      <ConfirmDialog
        open={quarantineOpen}
        onOpenChange={(open) => {
          setQuarantineOpen(open)
          if (!open) {
            setSelectedBatch(null)
            restoreOriginFocus(originKey)
          }
        }}
        tone="critical"
        title="انتقال به قرنطینه"
        description={
          selectedBatch
            ? `سری ساخت ${selectedBatch.batchNo} از صف ترخیص FEFO خارج می‌شود و رویداد قرنطینه در کاردکس ثبت می‌گردد.`
            : 'این سری ساخت به قرنطینه منتقل می‌شود.'
        }
        confirmLabel="تأیید قرنطینه"
        cancelLabel="انصراف"
        loading={saving}
        onConfirm={() => {
          void handleQuarantineConfirm()
        }}
      />

      <Dialog open={fefoHelpOpen} onOpenChange={setFefoHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>راهنما و پروتکل FEFO</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-body-sm text-text-secondary">
                <p>
                  خروج دارو باید بر اساس نزدیک‌ترین تاریخ انقضا (First Expiry,
                  First Out) انجام شود.
                </p>
                <p>
                  سری‌های قرنطینه یا مسدود از صف ترخیص خارج‌اند؛ اولویت ۱ همیشه
                  نزدیک‌ترین بچ فعال دارای موجودی است.
                </p>
                <p>
                  پیش از جابجایی یا ترخیص، وضعیت FEFO جدول بچ‌ها و نزدیک‌ترین
                  موعد انقضا در کارت‌های شاخص را بررسی کنید.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setFefoHelpOpen(false)}>
              متوجه شدم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
