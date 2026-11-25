'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Checkbox,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  TriageStatusBadge,
  type DenseColumn,
  type TriageStatus,
} from '@/components/shared'
import type { ReorderUrgency } from '@/lib/domain/reorder'
import {
  DRUG_CATEGORIES,
  type DrugCategory,
} from '@/lib/types/drugs'
import {
  DEFAULT_REORDER_FORMULA,
  REORDER_DISTRIBUTORS,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type ReorderFormulaConfig,
  type ReorderKpis,
} from '@/lib/types/reorder'
import {
  changePurchaseOrderStatus,
  dismissReorderSuggestions,
  draftReorderSuggestions,
  exportPurchaseOrderExcel,
  exportReorderProformaExcel,
  fetchPurchaseOrders,
  fetchReorderSuggestions,
  saveReorderSettings,
} from '@/lib/reorder/data-access'
import {
  estimateSelectedCost,
  groupSubtotalsByDistributor,
  selectionState,
  type ReorderSortField,
  type ReorderSuggestion,
} from '@/lib/reorder/reorder-query'
import { validateOrderQuantity } from '@/lib/reorder/quantity-validation'
import {
  formatPersianNumber,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'
import { cn } from '@/lib/utils'
import { getReorderNavItems } from './nav'
import { PurchaseOrdersPanel } from './purchase-orders-panel'
import { RopSettingsDrawer } from './rop-settings-drawer'

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const SEARCH_DEBOUNCE_MS = 300

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type BufferPct = 0 | 10 | 20

type ActiveChip = {
  id: string
  label: string
  clear: () => void
}

const URGENCY_LABELS: Record<ReorderUrgency, string> = {
  critical: 'کسری بحرانی / موجودی صفر',
  low: 'کمتر از حد ایمن',
  reorder: 'زیر نقطه سفارش (ROP)',
  ok: 'عادی',
}

const URGENCY_TRIAGE: Record<ReorderUrgency, TriageStatus> = {
  critical: 'critical',
  low: 'expiring',
  reorder: 'warning',
  ok: 'valid',
}

function sortAria(
  field: ReorderSortField,
  sortBy: ReorderSortField,
  sortDir: 'asc' | 'desc',
): 'ascending' | 'descending' | 'none' {
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
  field: ReorderSortField
  sortBy: ReorderSortField
  sortDir: 'asc' | 'desc'
  onSort: (field: ReorderSortField) => void
}) {
  const active = sortBy === field
  return (
    <button
      type="button"
      className="ps-focus-ring inline-flex items-center gap-1 rounded-inner text-start"
      onClick={() => onSort(field)}
      aria-pressed={active}
    >
      <span>{label}</span>
      <Icon
        name={
          !active ? 'unfold_more' : sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'
        }
        size={14}
        data-slot="icon"
      />
    </button>
  )
}

function formatDaysCover(days: number): string {
  if (!Number.isFinite(days)) return '—'
  const rounded = Math.round(days * 10) / 10
  return toPersianDigits(String(rounded))
}

function urgencyBadgeLabel(row: ReorderSuggestion): string {
  if (row.availableStock <= 0) return 'کسری شدید (موجودی صفر)'
  if (row.isControlled && row.urgency !== 'ok') {
    return `سهمیه‌ای / تحت کنترل (${formatDaysCover(row.daysOfCover)} روز)`
  }
  if (row.urgency === 'critical') {
    return `بحرانی (${formatDaysCover(row.daysOfCover)} روز مانده)`
  }
  if (row.urgency === 'low') return 'کمتر از حد ایمن'
  if (row.urgency === 'reorder') return 'نیاز به شارژ'
  return 'رو به اتمام'
}

export function AutoReorderSuggestionsView() {
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [distributorId, setDistributorId] = React.useState('')
  const [category, setCategory] = React.useState<DrugCategory | ''>('')
  const [urgency, setUrgency] = React.useState<ReorderUrgency | ''>('')
  const [controlled, setControlled] = React.useState<'all' | 'yes' | 'no'>('all')
  const [bufferPct, setBufferPct] = React.useState<BufferPct>(10)
  const [sortBy, setSortBy] = React.useState<ReorderSortField>('daysOfCover')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [loadState, setLoadState] = React.useState<LoadState>('loading')
  const [items, setItems] = React.useState<ReorderSuggestion[]>([])
  const [allActive, setAllActive] = React.useState<ReorderSuggestion[]>([])
  const [total, setTotal] = React.useState(0)
  const [pageCount, setPageCount] = React.useState(1)
  const [kpis, setKpis] = React.useState<ReorderKpis | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [finalQty, setFinalQty] = React.useState<Record<string, number>>({})
  const [manualIds, setManualIds] = React.useState<Set<string>>(new Set())
  const [qtyErrors, setQtyErrors] = React.useState<Record<string, string>>({})
  const [qtyDraft, setQtyDraft] = React.useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [confirmMode, setConfirmMode] = React.useState<'order' | 'draft'>('order')
  const [confirmLoading, setConfirmLoading] = React.useState(false)
  const [dismissId, setDismissId] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<'suggestions' | 'orders'>('suggestions')
  const [formulaConfig, setFormulaConfig] = React.useState<ReorderFormulaConfig>(
    DEFAULT_REORDER_FORMULA,
  )
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [settingsSaving, setSettingsSaving] = React.useState(false)
  const [exportingExcel, setExportingExcel] = React.useState(false)
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([])
  const [ordersLoading, setOrdersLoading] = React.useState(true)
  const formulaInitializedRef = React.useRef(false)
  const requestIdRef = React.useRef(0)
  const confirmOriginRef = React.useRef<HTMLElement | null>(null)

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
        distributorId,
        category,
        urgency,
        controlled,
        sortBy,
        sortDir,
        page,
        pageSize,
      }),
    [
      search,
      distributorId,
      category,
      urgency,
      controlled,
      sortBy,
      sortDir,
      page,
      pageSize,
    ],
  )

  const load = React.useCallback(async () => {
    const requestId = ++requestIdRef.current
    try {
      const result = await fetchReorderSuggestions({
        search,
        distributorId,
        category,
        urgency,
        isControlled:
          controlled === 'all' ? null : controlled === 'yes' ? true : false,
        activeOnly: true,
        sortBy,
        sortDir,
        page,
        pageSize,
      })
      if (requestId !== requestIdRef.current) return
      setItems(result.items)
      setAllActive(result.allActive)
      setTotal(result.total)
      setPageCount(result.pageCount)
      setPage(result.page)
      setKpis(result.kpis)
      setFormulaConfig(result.formula)
      if (!formulaInitializedRef.current) {
        formulaInitializedRef.current = true
        setBufferPct(result.formula.defaultBufferPct)
      }
      setFinalQty((prev) => {
        const next = { ...prev }
        for (const item of result.allActive) {
          if (next[item.id] === undefined) next[item.id] = item.suggestedQty
        }
        return next
      })
      setLoadState('ready')
    } catch {
      if (requestId !== requestIdRef.current) return
      setLoadState('error')
    }
  }, [
    search,
    distributorId,
    category,
    urgency,
    controlled,
    sortBy,
    sortDir,
    page,
    pageSize,
  ])

  const loadOrders = React.useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await fetchPurchaseOrders()
      setPurchaseOrders(res.items ?? [])
    } catch {
      // Keep current list on transient error
    } finally {
      setOrdersLoading(false)
    }
  }, [])

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

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchPurchaseOrders()
        if (cancelled) return
        setPurchaseOrders(res.items ?? [])
      } catch {
        // Keep current list on transient error
      } finally {
        if (!cancelled) setOrdersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
  if (distributorId) {
    const dist = REORDER_DISTRIBUTORS.find((d) => d.id === distributorId)
    chips.push({
      id: 'distributor',
      label: `پخش: ${dist?.nameFa ?? distributorId}`,
      clear: () => {
        setDistributorId('')
        setPage(1)
      },
    })
  }
  if (category) {
    chips.push({
      id: 'category',
      label: `گروه: ${category}`,
      clear: () => {
        setCategory('')
        setPage(1)
      },
    })
  }
  if (urgency) {
    chips.push({
      id: 'urgency',
      label: `فوریت: ${URGENCY_LABELS[urgency]}`,
      clear: () => {
        setUrgency('')
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
  if (bufferPct !== 0) {
    chips.push({
      id: 'buffer',
      label: `حاشیه اطمینان: +${toPersianDigits(bufferPct)}٪`,
      clear: () => setBufferPct(0),
    })
  }

  const visibleIds = items.map((item) => item.id)
  const selectState = selectionState(visibleIds, selectedIds)
  const selectedCount = [...selectedIds].filter((id) =>
    allActive.some((item) => item.id === id),
  ).length

  const bufferedFinalQty = React.useMemo(() => {
    const factor = 1 + bufferPct / 100
    const next: Record<string, number> = {}
    for (const item of allActive) {
      const base = finalQty[item.id] ?? item.suggestedQty
      if (manualIds.has(item.id) || bufferPct === 0) {
        next[item.id] = base
      } else {
        const raw = Math.ceil((base * factor) / item.packSize) * item.packSize
        next[item.id] = raw
      }
    }
    return next
  }, [allActive, bufferPct, finalQty, manualIds])

  const estimatedCost = estimateSelectedCost(
    allActive,
    selectedIds,
    bufferedFinalQty,
  )
  const subtotals = groupSubtotalsByDistributor(
    allActive,
    selectedIds,
    bufferedFinalQty,
  )
  const hasControlledSelected = allActive.some(
    (item) => selectedIds.has(item.id) && item.isControlled,
  )

  function handleSort(field: ReorderSortField) {
    if (sortBy === field) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(field === 'daysOfCover' ? 'asc' : 'asc')
    }
    setPage(1)
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selectState === 'all') {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function commitQty(row: ReorderSuggestion, raw: string) {
    const result = validateOrderQuantity(raw, row.packSize)
    if (!result.ok) {
      setQtyErrors((prev) => ({ ...prev, [row.id]: result.error }))
      return
    }
    setQtyErrors((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    setFinalQty((prev) => ({ ...prev, [row.id]: result.value }))
    setManualIds((prev) => {
      const next = new Set(prev)
      if (result.value !== row.suggestedQty) next.add(row.id)
      else next.delete(row.id)
      return next
    })
  }

  function adjustQty(row: ReorderSuggestion, delta: number) {
    const current = bufferedFinalQty[row.id] ?? row.suggestedQty
    const next = Math.max(0, current + delta * row.packSize)
    commitQty(row, String(next))
    setQtyDraft((prev) => ({ ...prev, [row.id]: String(next) }))
  }

  function resetToSuggestion(row: ReorderSuggestion) {
    setFinalQty((prev) => ({ ...prev, [row.id]: row.suggestedQty }))
    setManualIds((prev) => {
      const next = new Set(prev)
      next.delete(row.id)
      return next
    })
    setQtyDraft((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    setQtyErrors((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
  }

  function openConfirm(mode: 'order' | 'draft', origin?: HTMLElement | null) {
    if (selectedCount === 0) {
      toast.message('ابتدا حداقل یک قلم را انتخاب کنید.')
      return
    }
    const invalid = [...selectedIds].some((id) => qtyErrors[id])
    if (invalid) {
      toast.error('تعداد سفارش برخی اقلام نامعتبر است.')
      return
    }
    confirmOriginRef.current = origin ?? (document.activeElement as HTMLElement)
    setConfirmMode(mode)
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    setConfirmLoading(true)
    try {
      const ids = [...selectedIds]
      // Send already-buffered display qty; bufferPct=0 avoids double-applying on API.
      const draftItems = ids.map((id) => ({
        id,
        finalQty: bufferedFinalQty[id] ?? finalQty[id] ?? 0,
      }))
      const zeroItem = draftItems.find((item) => item.finalQty <= 0)
      if (zeroItem) {
        toast.error('تعداد سفارش هر قلم انتخابی باید بزرگ‌تر از صفر باشد.')
        setConfirmLoading(false)
        return
      }
      const mode = confirmMode === 'order' ? 'submit' : 'draft'
      const result = await draftReorderSuggestions(draftItems, 0, {
        mode,
        technicalConfirm: hasControlledSelected,
      })
      setSelectedIds(new Set())
      setConfirmOpen(false)
      const orderNumbers = (result.orders ?? [])
        .map((o) => o.orderNumber)
        .filter(Boolean)
        .join('، ')
      toast.success(
        confirmMode === 'order'
          ? orderNumbers
            ? `سفارش خرید با موفقیت ثبت و به کارتابل خرید ارسال شد (${orderNumbers}).`
            : 'سفارش‌های خرید به تفکیک شرکت پخش ثبت شد.'
          : orderNumbers
            ? `پیش‌نویس سفارش ذخیره شد (${orderNumbers}).`
            : 'اقلام انتخابی در پیش‌نویس‌ها ذخیره شد.',
      )
      await Promise.all([load(), loadOrders()])
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'ثبت سفارش خرید انجام نشد.',
      )
    } finally {
      setConfirmLoading(false)
      window.setTimeout(() => confirmOriginRef.current?.focus?.(), 0)
    }
  }

  async function handleExportExcel() {
    if (exportingExcel) return
    setExportingExcel(true)
    try {
      const selectedList = [...selectedIds].filter((id) =>
        allActive.some((item) => item.id === id),
      )
      const exportItems = selectedList.map((id) => ({
        id,
        finalQty: bufferedFinalQty[id] ?? finalQty[id] ?? 0,
      }))
      const filename = await exportReorderProformaExcel({
        items: exportItems,
        bufferPct,
        search,
        distributorId,
        category,
        urgency,
        isControlled:
          controlled === 'all' ? null : controlled === 'yes' ? true : false,
      })
      toast.success(
        selectedList.length > 0
          ? `پیش‌فاکتور اکسل برای ${toPersianDigits(selectedList.length)} قلم انتخابی دانلود شد (${filename}).`
          : `پیش‌فاکتور اکسل فهرست پیشنهادها دانلود شد (${filename}).`,
      )
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'خروجی اکسل پیش‌فاکتور انجام نشد.',
      )
    } finally {
      setExportingExcel(false)
    }
  }

  async function handleSaveSettings(cfg: ReorderFormulaConfig) {
    setSettingsSaving(true)
    try {
      const saved = await saveReorderSettings(cfg)
      setFormulaConfig(saved)
      setBufferPct(saved.defaultBufferPct)
      setFinalQty({})
      setManualIds(new Set())
      setQtyDraft({})
      setQtyErrors({})
      setSettingsOpen(false)
      toast.success('تنظیمات فرمول ROP ذخیره و محاسبات بروزرسانی شد.')
      await load()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'ذخیره تنظیمات فرمول انجام نشد.',
      )
    } finally {
      setSettingsSaving(false)
    }
  }

  async function handleOrderStatus(
    id: string,
    status: PurchaseOrderStatus,
    technicalConfirm?: boolean,
  ) {
    try {
      const updated = await changePurchaseOrderStatus(id, {
        status,
        technicalConfirm,
      })
      toast.success(
        status === 'cancelled'
          ? `سفارش ${updated.orderNumber} لغو شد و اقلام به پیشنهادها بازگشت.`
          : status === 'approved'
            ? `سفارش ${updated.orderNumber} تأیید نهایی شد.`
            : `سفارش ${updated.orderNumber} به شرکت پخش ارسال شد.`,
      )
      await Promise.all([loadOrders(), load()])
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'تغییر وضعیت سفارش انجام نشد.',
      )
    }
  }

  async function handleExportOrder(id: string) {
    try {
      const filename = await exportPurchaseOrderExcel(id)
      toast.success(`فایل اکسل سفارش دانلود شد (${filename}).`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'خروجی اکسل سفارش انجام نشد.',
      )
    }
  }

  async function handleDismiss(id: string) {
    try {
      await dismissReorderSuggestions([id])
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setDismissId(null)
      toast.message('قلم موقتاً از فهرست پیشنهاد حذف شد.')
      await load()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'حذف پیشنهاد انجام نشد.',
      )
    }
  }

  const columns: DenseColumn<ReorderSuggestion>[] = [
    {
      id: 'select',
      header: <span className="sr-only">انتخاب</span>,
      className: 'w-10',
      cell: (row) => (
        <Checkbox
          aria-label={`انتخاب ${row.nameFa}`}
          checked={selectedIds.has(row.id)}
          onCheckedChange={(checked) => toggleRow(row.id, checked === true)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === ' ') event.stopPropagation()
          }}
        />
      ),
    },
    {
      id: 'nameFa',
      ariaSort: sortAria('nameFa', sortBy, sortDir),
      header: (
        <SortableHeader
          label="نام دارو، شکل دارویی و شناسه IRC"
          field="nameFa"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => (
        <div className="flex items-start gap-2">
          <span
            className={cn(
              'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-default',
              row.urgency === 'critical'
                ? 'bg-status-critical-bg text-status-critical-fg'
                : row.storageTemp === 'fridge'
                  ? 'bg-secondary-tint text-secondary'
                  : 'bg-surface-subtle text-text-secondary',
            )}
            aria-hidden
          >
            <Icon
              name={
                row.storageTemp === 'fridge'
                  ? 'vaccines'
                  : row.dosageForm === 'سرم'
                    ? 'water_drop'
                    : 'medication'
              }
              size={18}
              data-slot="icon"
            />
          </span>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-lg font-semibold text-text-primary">
                {row.nameFa} {row.strength}
              </span>
              {manualIds.has(row.id) ? (
                <Badge variant="secondary" className="text-[10px]">
                  اصلاح دستی
                </Badge>
              ) : null}
              {row.isControlled ? (
                <Icon
                  name="lock"
                  size={14}
                  className="text-status-critical-fg"
                  data-slot="icon"
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-label-sm text-text-secondary">
              <span className="font-latin tabular-nums-data" dir="ltr">
                IRC: {toPersianDigits(row.irc)}
              </span>
              <span aria-hidden>•</span>
              <span>{row.locationHint}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'distributor',
      ariaSort: sortAria('distributorNameFa', sortBy, sortDir),
      header: (
        <SortableHeader
          label="شرکت پخش پیشنهادی"
          field="distributorNameFa"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => (
        <div>
          <div className="text-label-md text-text-primary">{row.distributorNameFa}</div>
          <div
            className={cn(
              'text-label-sm',
              row.distributorNote.includes('محدودیت') ||
                row.distributorNote.includes('صفر')
                ? 'text-status-critical-fg'
                : 'text-text-secondary',
            )}
          >
            {row.distributorNote}
          </div>
        </div>
      ),
    },
    {
      id: 'availableStock',
      ariaSort: sortAria('availableStock', sortBy, sortDir),
      header: (
        <SortableHeader
          label="موجودی فعلی"
          field="availableStock"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      align: 'end',
      cell: (row) => (
        <span
          className={cn(
            'inline-flex rounded-inner px-2 py-0.5 font-bold tabular-nums-data',
            row.availableStock <= 0 || row.urgency === 'critical'
              ? 'bg-status-critical-bg text-status-critical-fg'
              : 'bg-surface-subtle text-text-primary',
          )}
        >
          {formatPersianNumber(row.availableStock)} {row.unitLabel}
        </span>
      ),
    },
    {
      id: 'adu',
      header: 'میانگین روزانه (ADU)',
      align: 'end',
      cell: (row) => (
        <span className="tabular-nums-data">
          {formatPersianNumber(row.avgDailyUsage)} {row.unitLabel}
        </span>
      ),
    },
    {
      id: 'lead',
      header: 'زمان تامین (روز)',
      align: 'end',
      cell: (row) => (
        <span className="tabular-nums-data">
          {toPersianDigits(row.leadTimeDays)} روز
        </span>
      ),
    },
    {
      id: 'minmax',
      header: 'بازه Min / Max',
      align: 'end',
      cell: (row) => (
        <span className="tabular-nums-data">
          <span className="text-text-secondary">
            {formatPersianNumber(row.reorderPoint)}
          </span>
          {' / '}
          <span className="font-medium text-text-primary">
            {formatPersianNumber(row.targetStock)}
          </span>
        </span>
      ),
    },
    {
      id: 'suggested',
      ariaSort: sortAria('suggestedQty', sortBy, sortDir),
      header: (
        <SortableHeader
          label="پیشنهاد هوشمند"
          field="suggestedQty"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      align: 'end',
      cell: (row) => (
        <span
          className={cn(
            'tabular-nums-data font-bold',
            manualIds.has(row.id)
              ? 'text-text-secondary line-through'
              : 'text-primary',
          )}
        >
          {formatPersianNumber(row.suggestedQty)} {row.unitLabel}
        </span>
      ),
    },
    {
      id: 'finalQty',
      header: 'تعداد سفارش نهایی',
      cell: (row) => {
        const display =
          qtyDraft[row.id] ??
          String(bufferedFinalQty[row.id] ?? row.suggestedQty)
        return (
          <div className="space-y-1">
            <div
              className={cn(
                'mx-auto flex max-w-[9rem] items-center justify-center gap-1 rounded-default bg-surface-subtle p-1',
                manualIds.has(row.id) && 'ring-1 ring-primary',
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`کاهش ${row.nameFa}`}
                onClick={() => adjustQty(row, -1)}
              >
                −
              </Button>
              <Input
                aria-label={`تعداد سفارش ${row.nameFa}`}
                className="h-7 w-12 border-0 bg-transparent px-0 text-center tabular-nums-data font-bold shadow-none"
                inputMode="numeric"
                min={0}
                step={row.packSize}
                value={toPersianDigits(display)}
                aria-invalid={Boolean(qtyErrors[row.id]) || undefined}
                aria-describedby={
                  qtyErrors[row.id] ? `qty-err-${row.id}` : undefined
                }
                onChange={(event) => {
                  const latin = event.target.value.replace(/[۰-۹]/g, (d) =>
                    String(d.charCodeAt(0) - '۰'.charCodeAt(0)),
                  )
                  setQtyDraft((prev) => ({ ...prev, [row.id]: latin }))
                }}
                onBlur={(event) => {
                  const latin = event.target.value.replace(/[۰-۹]/g, (d) =>
                    String(d.charCodeAt(0) - '۰'.charCodeAt(0)),
                  )
                  commitQty(row, latin)
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`افزایش ${row.nameFa}`}
                onClick={() => adjustQty(row, 1)}
              >
                +
              </Button>
              <span className="pe-1 text-label-sm text-text-secondary">
                {row.unitLabel}
              </span>
            </div>
            {qtyErrors[row.id] ? (
              <p
                id={`qty-err-${row.id}`}
                className="text-center text-label-sm text-status-critical-fg"
                role="alert"
              >
                {qtyErrors[row.id]}
              </p>
            ) : null}
            {manualIds.has(row.id) ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-label-sm"
                  onClick={() => resetToSuggestion(row)}
                >
                  <Icon name="refresh" size={14} data-slot="icon" />
                  بازگشت به پیشنهاد
                </Button>
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      id: 'urgency',
      ariaSort: sortAria('daysOfCover', sortBy, sortDir),
      header: (
        <SortableHeader
          label="وضعیت فوریت"
          field="daysOfCover"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      ),
      cell: (row) => (
        <TriageStatusBadge status={URGENCY_TRIAGE[row.urgency]}>
          {urgencyBadgeLabel(row)}
        </TriageStatusBadge>
      ),
    },
    {
      id: 'actions',
      header: 'عملیات',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1 text-text-secondary">
          <ActionTooltip title="نمودار روند مصرف">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`نمودار مصرف ${row.nameFa}`}
              onClick={() =>
                toast.message('صفحه نمودار مصرف هنوز پیاده‌سازی نشده است.')
              }
            >
              <Icon name="show_chart" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
          <ActionTooltip title="تغییر تامین‌کننده">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`تغییر پخش ${row.nameFa}`}
              onClick={() =>
                toast.message('تغییر شرکت پخش در این نسخه شبیه‌سازی نشده است.')
              }
            >
              <Icon name="swap_horiz" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
          <ActionTooltip title="حذف موقت از لیست سفارش">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`حذف موقت ${row.nameFa}`}
              onClick={() => setDismissId(row.id)}
            >
              <Icon name="close" size={18} data-slot="icon" />
            </Button>
          </ActionTooltip>
        </div>
      ),
    },
  ]

  const isEmptyCatalog = loadState === 'ready' && allActive.length === 0 && !search && !distributorId && !category && !urgency && controlled === 'all'
  const isNoMatch =
    loadState === 'ready' && total === 0 && allActive.length > 0

  const confirmDescription = (
    <div className="space-y-3 text-start text-body-sm text-text-secondary">
      <p>
        {confirmMode === 'order'
          ? `با تأیید، اقلام انتخابی به ${toPersianDigits(subtotals.length)} سفارش خرید مجزا به تفکیک شرکت پخش تبدیل و در کارتابل خرید ثبت می‌شوند.`
          : `اقلام انتخابی در قالب ${toPersianDigits(subtotals.length)} پیش‌نویس سفارش به تفکیک شرکت پخش ذخیره می‌شوند.`}
      </p>
      <ul className="space-y-1">
        {subtotals.map((group) => (
          <li key={group.distributorId}>
            <span className="font-semibold text-text-primary">
              {group.distributorNameFa}
            </span>
            : {toPersianDigits(group.itemCount)} قلم · جمع{' '}
            {formatRial(group.estimatedCost)}
          </li>
        ))}
      </ul>
      <p className="font-semibold text-text-primary">
        جمع کل برآورد: {formatRial(estimatedCost)}
      </p>
      {hasControlledSelected ? (
        <p className="rounded-default bg-status-critical-bg px-3 py-2 text-status-critical-fg">
          توجه: حداقل یک قلم تحت کنترل / سهمیه‌ای در انتخاب شماست و نیازمند تأیید
          صریح مسئول فنی است.
        </p>
      ) : null}
    </div>
  )

  return (
    <AppShell
      navItems={getReorderNavItems('reorder')}
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
    >
      <div
        className="flex flex-col gap-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]"
        data-slot="auto-reorder-suggestions"
      >
        <PageHeader
          title="پیشنهاد سفارش هوشمند دارو (بر اساس نقطه سفارش مجدد ROP)"
          description="محاسبه خودکار نیاز تامین انبار بر اساس میانگین مصرف روزانه، زمان تحویل شرکت‌های پخش (Lead Time) و حداقل/حداکثر موجودی ایمن جهت جلوگیری از کسری یا انباشت غیرمجاز سرمایه در گردش."
          actions={
            <>
              <Badge variant="secondary">
                {formulaConfig.mode === 'dynamic_adu'
                  ? 'مدل پویا (ADU × Lead Time)'
                  : 'محاسبه پویا برخط'}
              </Badge>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSettingsOpen(true)}
              >
                <Icon name="tune" size={18} data-slot="icon" />
                تنظیمات فرمول ROP
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exportingExcel}
                onClick={() => void handleExportExcel()}
              >
                <Icon name="table_view" size={18} data-slot="icon" />
                {exportingExcel
                  ? 'در حال تولید اکسل...'
                  : 'خروجی اکسل پیش‌فاکتور'}
              </Button>
              <Button
                type="button"
                onClick={(event) =>
                  openConfirm('order', event.currentTarget)
                }
              >
                <Icon name="shopping_cart_checkout" size={20} data-slot="icon" />
                تبدیل اقلام انتخابی به سفارش خرید
              </Button>
            </>
          }
        />

        {loadState === 'error' ? (
          <AlertBanner
            tone="critical"
            title="خطا در بارگذاری پیشنهادها"
            description="بارگذاری فهرست پیشنهاد سفارش با خطا مواجه شد."
            action={
              <Button type="button" variant="outline" onClick={() => void load()}>
                تلاش مجدد
              </Button>
            }
          />
        ) : null}

        {loadState === 'loading' ? (
          <div
            data-slot="auto-reorder-skeleton"
            className="grid gap-4"
            aria-busy="true"
            aria-label="در حال بارگذاری پیشنهاد سفارش"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-default bg-surface-subtle"
                />
              ))}
            </div>
            <div className="h-16 animate-pulse rounded-default bg-surface-subtle" />
            <div className="h-72 animate-pulse rounded-default bg-surface-subtle" />
          </div>
        ) : null}

        {loadState === 'ready' && kpis ? (
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'suggestions' | 'orders')}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-3">
              <TabsList className="bg-surface-muted">
                <TabsTrigger value="suggestions" className="gap-2">
                  <Icon name="auto_awesome" size={16} data-slot="icon" />
                  <span>پیشنهادهای فعال ROP</span>
                  <Badge variant="secondary" className="text-label-sm">
                    {toPersianDigits(total)}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="orders" className="gap-2">
                  <Icon name="shopping_cart" size={16} data-slot="icon" />
                  <span>کارتابل سفارش‌های خرید</span>
                  {purchaseOrders.length > 0 ? (
                    <Badge variant="outline" className="text-label-sm">
                      {toPersianDigits(purchaseOrders.length)}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <div className="text-label-sm text-text-secondary">
                {activeTab === 'suggestions'
                  ? `حالت فرمول: ${formulaConfig.mode === 'dynamic_adu' ? 'پویا (ADU + Lead Time)' : 'ثابت کاتالوگ'}`
                  : `مجموع سفارش‌ها: ${toPersianDigits(purchaseOrders.length)} سفارش`}
              </div>
            </div>

            <TabsContent value="orders" className="mt-0 focus-visible:outline-none">
              <PurchaseOrdersPanel
                orders={purchaseOrders}
                loading={ordersLoading}
                onRefresh={loadOrders}
                onUpdateStatus={handleOrderStatus}
                onExportOrder={handleExportOrder}
              />
            </TabsContent>

            <TabsContent value="suggestions" className="mt-0 space-y-6 focus-visible:outline-none">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <KpiMetricCard
                title="کل اقلام زیر نقطه ROP"
                value={
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span>{formatPersianNumber(kpis.belowRopCount)}</span>
                    <span className="text-label-sm font-normal text-text-secondary">
                      قلم دارو
                    </span>
                  </div>
                }
                icon="warning"
                tone="critical"
                delta={{
                  label: `${toPersianDigits(kpis.yesterdayDelta)} قلم افزایش نسبت به دیروز`,
                  direction: 'up',
                }}
              />
              <KpiMetricCard
                title="اقلام اتمام موجودی (صفر)"
                value={
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span>{formatPersianNumber(kpis.zeroStockCount)}</span>
                    <span className="text-label-sm font-normal text-text-secondary">
                      قلم حیاتی
                    </span>
                  </div>
                }
                icon="inventory_2"
                tone="critical"
                description="نیازمند ثبت سفارش فوری"
              />
              <KpiMetricCard
                title="تخمین ارزش پیشنهادی"
                value={
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="min-w-0 max-w-full break-words text-headline-lg 2xl:text-kpi">
                      {formatRial(kpis.estimatedValue, { withCurrency: false })}
                    </span>
                    <span className="text-label-sm font-normal text-text-secondary">
                      ریال
                    </span>
                  </div>
                }
                icon="payments"
                tone="primary"
                description="در حد نصاب نقدینگی ماهانه"
              />
              <KpiMetricCard
                title="میانگین تحویل (Lead Time)"
                value={
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span>{formatDaysCover(kpis.avgLeadTimeDays)}</span>
                    <span className="text-label-sm font-normal text-text-secondary">
                      روز کاری
                    </span>
                  </div>
                }
                icon="local_shipping"
                tone="info"
                description="بر اساس عملکرد ۳۰ روز گذشته"
              />
              <KpiMetricCard
                title="تفکیک پخش‌های هدف"
                icon="hub"
                tone="neutral"
                value={
                  <div className="grid grid-cols-2 gap-1 text-label-sm font-normal">
                    {kpis.byDistributor.slice(0, 4).map((dist) => (
                      <div
                        key={dist.id}
                        className="flex min-w-0 items-center justify-between gap-1 rounded-inner bg-surface-subtle px-2 py-1"
                      >
                        <span className="truncate text-text-secondary">
                          {dist.nameFa}:
                        </span>
                        <span className="shrink-0 font-bold text-primary tabular-nums-data">
                          {formatPersianNumber(dist.count)} قلم
                        </span>
                      </div>
                    ))}
                  </div>
                }
              />
            </div>

            <div
              data-slot="auto-reorder-filters"
              className="flex flex-col gap-4 rounded-default border border-border-default bg-surface p-4"
            >
              <div className="relative min-w-0 w-full">
                <Icon
                  name="search"
                  size={18}
                  className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-text-placeholder"
                  data-slot="icon"
                />
                <Input
                  type="search"
                  className="h-10 ps-10"
                  placeholder="فیلتر نام ژنریک یا IRC در این لیست..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  aria-label="جستجوی نام دارو در پیشنهادها"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={distributorId || '__all__'}
                  onValueChange={(value) => {
                    setDistributorId(value === '__all__' ? '' : value)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[12rem]" aria-label="فیلتر شرکت پخش">
                    <SelectValue placeholder="همه شرکت‌های پخش" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      همه شرکت‌های پخش ({toPersianDigits(kpis.belowRopCount)})
                    </SelectItem>
                    {REORDER_DISTRIBUTORS.map((dist) => (
                      <SelectItem key={dist.id} value={dist.id}>
                        {dist.nameFa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={urgency || '__all__'}
                  onValueChange={(value) => {
                    setUrgency(
                      value === '__all__' ? '' : (value as ReorderUrgency),
                    )
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[11rem]" aria-label="فیلتر سطح فوریت">
                    <SelectValue placeholder="تمامی سطوح کسری" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">تمامی سطوح کسری</SelectItem>
                    <SelectItem value="critical">{URGENCY_LABELS.critical}</SelectItem>
                    <SelectItem value="low">{URGENCY_LABELS.low}</SelectItem>
                    <SelectItem value="reorder">{URGENCY_LABELS.reorder}</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={category || '__all__'}
                  onValueChange={(value) => {
                    setCategory(
                      value === '__all__' ? '' : (value as DrugCategory),
                    )
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[11rem]" aria-label="فیلتر گروه دارویی">
                    <SelectValue placeholder="تمامی گروه‌های دارویی" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">تمامی گروه‌های دارویی</SelectItem>
                    {DRUG_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={controlled}
                  onValueChange={(value) => {
                    setControlled(value as 'all' | 'yes' | 'no')
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[9rem]" aria-label="فیلتر تحت کنترل">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه اقلام</SelectItem>
                    <SelectItem value="yes">فقط تحت کنترل</SelectItem>
                    <SelectItem value="no">غیرکنترلی</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1 rounded-default bg-surface-subtle p-1">
                  <span className="px-2 text-label-sm text-text-secondary">
                    حاشیه اطمینان (Buffer):
                  </span>
                  {([0, 10, 20] as BufferPct[]).map((pct) => (
                    <Button
                      key={pct}
                      type="button"
                      size="sm"
                      variant={bufferPct === pct ? 'default' : 'ghost'}
                      className="h-8"
                      aria-pressed={bufferPct === pct}
                      onClick={() => setBufferPct(pct)}
                    >
                      {pct === 0
                        ? 'عادی (۰٪)'
                        : `+${toPersianDigits(pct)}٪`}
                    </Button>
                  ))}
                </div>
              </div>

              {chips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {chips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className="ps-focus-ring inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle px-2.5 py-1 text-label-sm"
                      onClick={chip.clear}
                    >
                      <span>{chip.label}</span>
                      <Icon name="close" size={14} data-slot="icon" />
                    </button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchInput('')
                      setSearch('')
                      setDistributorId('')
                      setCategory('')
                      setUrgency('')
                      setControlled('all')
                      setBufferPct(0)
                      setPage(1)
                    }}
                  >
                    پاک کردن همه
                  </Button>
                </div>
              ) : null}
            </div>

            {isEmptyCatalog ? (
              <AlertBanner
                tone="info"
                title="موردی برای سفارش مجدد نیست"
                description="در حال حاضر هیچ قلمی زیر نقطه سفارش (ROP) قرار ندارد."
              />
            ) : null}

            {isNoMatch ? (
              <AlertBanner
                tone="warning"
                title="نتیجه‌ای با این فیلترها یافت نشد"
                description="فیلترها یا جستجو را تغییر دهید، یا همه را پاک کنید."
              />
            ) : null}

            {!isEmptyCatalog && !isNoMatch ? (
              <div className="overflow-hidden rounded-default border border-border-default bg-surface">
                <div className="flex flex-col gap-2 bg-surface-muted px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex items-center gap-2 text-label-md">
                    <Checkbox
                      checked={
                        selectState === 'all'
                          ? true
                          : selectState === 'indeterminate'
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={() => toggleSelectAll()}
                      aria-label="انتخاب تمامی اقلام این برگه"
                    />
                    <span>
                      انتخاب تمامی اقلام (
                      {toPersianDigits(items.length)} قلم در این برگه)
                    </span>
                  </label>
                  <p className="inline-flex items-center gap-1 text-label-sm text-text-secondary">
                    <Icon
                      name="check_circle"
                      size={16}
                      className="text-secondary"
                      data-slot="icon"
                    />
                    <span>
                      فرمول محاسبه:{' '}
                      <span className="font-semibold text-text-primary">
                        پیشنهاد = گرد کردن به بالا (هدف − موجودی − در راه) بر اساس
                        بسته‌بندی
                      </span>
                    </span>
                  </p>
                </div>

                <div aria-live="polite" className="sr-only">
                  {toPersianDigits(selectedCount)} قلم انتخاب شده
                </div>

                <DenseDataTable
                  columns={columns}
                  data={items}
                  getRowId={(row) => row.id}
                  maxHeight="min(32rem, 60vh)"
                  className="rounded-none border-0"
                />

                <div className="flex flex-col items-center justify-between gap-3 bg-surface-muted p-4 sm:flex-row">
                  <p className="text-label-sm text-text-secondary">
                    نمایش {toPersianDigits(items.length)} قلم از{' '}
                    {toPersianDigits(total)} پیشنهاد فعال · مرتب‌سازی بر اساس:{' '}
                    {sortBy === 'daysOfCover'
                      ? 'کمترین پوشش روزانه (فوریت)'
                      : 'ستون انتخاب‌شده'}
                  </p>
                  <Pagination
                    page={page}
                    pageCount={pageCount}
                    onPageChange={setPage}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    onPageSizeChange={(size) => {
                      setPageSize(size)
                      setPage(1)
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-3 rounded-default border border-border-default bg-surface p-4">
              <Icon
                name="policy"
                size={24}
                className="mt-0.5 shrink-0 text-primary"
                data-slot="icon"
              />
              <div className="space-y-1">
                <h2 className="text-title-md font-semibold text-text-primary">
                  دستورالعمل تطبیق سفارش هوشمند و سهمیه‌های وزارت بهداشت
                </h2>
                <p className="text-body-sm leading-relaxed text-text-secondary">
                  محاسبات بر مبنای مدل نقطه سفارش مجدد و پوشش روزهای مصرف انجام شده
                  است. برای اقلام تحت نظارت تیتک (TTAC) و سهمیه‌ای مانند انسولین و
                  فرآورده‌های تحت کنترل، تأییدیه نهایی منوط به تطبیق با سهمیه
                  تخصیص‌یافته توسط کارشناس فنی داروخانه خواهد بود.
                </p>
              </div>
            </div>
            </TabsContent>
          </Tabs>
        ) : null}

        {selectedCount > 0 ? (
          <div
            data-slot="reorder-selection-bar"
            className="fixed inset-inline-start-0 bottom-0 z-30 border-t border-border-default bg-surface/95 p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md md:inset-inline-start-[var(--ps-sidebar-width,260px)]"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-headline-sm font-bold tabular-nums-data">
                    {toPersianDigits(selectedCount)}
                  </span>
                  <div>
                    <div className="text-label-lg text-text-primary">
                      {toPersianDigits(selectedCount)} قلم دارویی انتخاب شده برای
                      سفارش مجدد
                    </div>
                    <div className="text-label-sm text-text-secondary">
                      تفکیک خودکار به {toPersianDigits(subtotals.length)} پیش‌فاکتور
                      مجزا
                      {subtotals.length > 0
                        ? ` (${subtotals.map((g) => g.distributorNameFa).join(' و ')})`
                        : ''}
                    </div>
                  </div>
                </div>
                <div className="hidden h-8 w-px bg-border-default sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-label-md text-text-secondary">
                    جمع برآورد ریالی اقلام انتخابی:
                  </span>
                  <span className="text-headline-sm font-bold tabular-nums-data text-primary">
                    {formatRial(estimatedCost, { withCurrency: false })}
                  </span>
                  <span className="text-label-sm text-text-primary">ریال</span>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(event) => openConfirm('draft', event.currentTarget)}
                >
                  <Icon name="drafts" size={18} data-slot="icon" />
                  ذخیره در پیش‌نویس‌ها
                </Button>
                <Button
                  type="button"
                  onClick={(event) => openConfirm('order', event.currentTarget)}
                >
                  <Icon name="send_and_archive" size={20} data-slot="icon" />
                  صدور پیش‌فاکتور و ارسال به کارتابل خرید
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) {
            window.setTimeout(() => confirmOriginRef.current?.focus?.(), 0)
          }
        }}
        tone={hasControlledSelected ? 'critical' : 'warning'}
        title={
          confirmMode === 'order'
            ? 'تأیید صدور پیش‌فاکتور سفارش'
            : 'ذخیره در پیش‌نویس‌ها'
        }
        description={confirmDescription}
        confirmLabel={
          confirmMode === 'order' ? 'تأیید و ثبت پیش‌نویس' : 'ذخیره پیش‌نویس'
        }
        cancelLabel="انصراف"
        loading={confirmLoading}
        onConfirm={() => void handleConfirm()}
      />

      <ConfirmDialog
        open={Boolean(dismissId)}
        onOpenChange={(open) => {
          if (!open) setDismissId(null)
        }}
        tone="warning"
        title="حذف موقت از فهرست پیشنهاد"
        description="این قلم تا بارگذاری مجدد از فهرست پیشنهادهای فعال حذف می‌شود (بدون دلیل الزامی در مرجع Stitch)."
        confirmLabel="حذف موقت"
        cancelLabel="انصراف"
        onConfirm={() => {
          if (dismissId) void handleDismiss(dismissId)
        }}
      />

      <RopSettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialConfig={formulaConfig}
        saving={settingsSaving}
        onSave={handleSaveSettings}
      />
    </AppShell>
  )
}
