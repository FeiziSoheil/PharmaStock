'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Dialog,
  DialogContent,
  DialogTitle,
  Label,
  Skeleton,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import {
  AlertBanner,
  ConfirmDialog,
  KpiMetricCard,
  PageHeader,
} from '@/components/shared'
import { PrintableDocumentPreview } from '@/components/domain'
import { ApiError } from '@/lib/api/http'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'
import {
  confirmStocktake,
  createStocktake,
  exportStocktakeCsv,
  getStocktake,
  listStocktakes,
  recordStocktakeItem,
  updateStocktake,
} from '@/lib/stocktake/data-access'
import {
  matchesStocktakeSearch,
  parseNonNegativeCount,
  pickNextPendingItemId,
} from '@/lib/stocktake/gating'
import type {
  StocktakeCycle,
  StocktakeCycleListItem,
  StocktakeItem,
  StocktakeMethod,
  StocktakeVarianceFilter,
  StocktakeZoneOption,
} from '@/lib/types/stocktake'
import { AdjustmentSummaryBar } from './adjustment-summary-bar'
import { CycleSetupCard } from './cycle-setup-card'
import { LiveCountTerminal } from './live-count-terminal'
import { getPeriodicStocktakeNavItems } from './nav'
import { VarianceTableSection } from './variance-table-section'

const PAGE_TITLE = 'شمارش و انبارگردانی دوره‌ای داروخانه'

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.fields && typeof err.fields === 'object') {
      const parts = Object.values(err.fields as Record<string, unknown>).filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      )
      if (parts.length > 0) return parts.join(' ')
    }
    return err.message || 'درخواست ناموفق بود.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'خطای غیرمنتظره رخ داد.'
}

function asZoneOption(zone: string | undefined): StocktakeZoneOption {
  if (zone === 'A' || zone === 'C' || zone === 'R' || zone === 'S') return zone
  return 'all'
}

export function PeriodicStocktakeView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlCycleId = searchParams.get('cycleId')

  const [cycles, setCycles] = React.useState<StocktakeCycleListItem[]>([])
  const [cycle, setCycle] = React.useState<StocktakeCycle | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [selectedZone, setSelectedZone] =
    React.useState<StocktakeZoneOption>('all')
  const [selectedMethod, setSelectedMethod] =
    React.useState<StocktakeMethod>('blind')
  const [counterName, setCounterName] = React.useState('مرتضی کاظمی')
  const [supervisorName, setSupervisorName] = React.useState('دکتر رضایی')

  const [activeItemId, setActiveItemId] = React.useState<string | null>(null)
  const [scannerQuery, setScannerQuery] = React.useState('')
  const [countInput, setCountInput] = React.useState('')
  const [reasonInput, setReasonInput] = React.useState('')

  const [filter, setFilter] = React.useState<StocktakeVarianceFilter>('all')
  const [tableSearch, setTableSearch] = React.useState('')

  const [creating, setCreating] = React.useState(false)
  const [savingSettings, setSavingSettings] = React.useState(false)
  const [submittingCount, setSubmittingCount] = React.useState(false)
  const [busyItemId, setBusyItemId] = React.useState<string | null>(null)
  const [exporting, setExporting] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false)
  const [supervisorConfirmChecked, setSupervisorConfirmChecked] =
    React.useState(false)
  const [printOpen, setPrintOpen] = React.useState(false)

  const selectActiveItem = React.useCallback((item: StocktakeItem | null) => {
    setActiveItemId(item?.id ?? null)
    setCountInput(
      item?.physicalQty != null ? toPersianDigits(item.physicalQty) : '',
    )
    setReasonInput(item?.varianceReason ?? '')
  }, [])

  const syncFormFromCycle = React.useCallback(
    (loaded: StocktakeCycle, preferredItemId?: string | null) => {
      setCycle(loaded)
      setSelectedZone(asZoneOption(loaded.zone))
      setSelectedMethod(loaded.method)
      setCounterName(loaded.counterName || 'مرتضی کاظمی')
      setSupervisorName(loaded.supervisorName || 'دکتر رضایی')
      const candidateId =
        preferredItemId ?? pickNextPendingItemId(loaded.items)
      const found =
        (candidateId
          ? loaded.items.find((it) => it.id === candidateId)
          : undefined) ?? null
      selectActiveItem(found)
    },
    [selectActiveItem],
  )

  const loadCycleData = React.useCallback(
    async (targetId?: string | null) => {
      const listRes = await listStocktakes({ page: 1, pageSize: 25 })
      const resolvedId =
        targetId ??
        listRes.items.find((c) => c.status === 'active')?.id ??
        listRes.items[0]?.id
      const detail = resolvedId ? await getStocktake(resolvedId) : null
      return { list: listRes.items, detail }
    },
    [],
  )

  const refreshAll = React.useCallback(
    async (targetId?: string | null) => {
      setLoading(true)
      setLoadError(null)
      try {
        const { list, detail } = await loadCycleData(targetId)
        setCycles(list)
        if (detail) {
          syncFormFromCycle(detail)
        } else {
          setCycle(null)
          selectActiveItem(null)
        }
      } catch (err) {
        setLoadError(errorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [loadCycleData, selectActiveItem, syncFormFromCycle],
  )

  React.useEffect(() => {
    let cancelled = false
    loadCycleData(urlCycleId)
      .then(({ list, detail }) => {
        if (cancelled) return
        setCycles(list)
        setLoadError(null)
        if (detail) {
          syncFormFromCycle(detail)
        } else {
          setCycle(null)
          selectActiveItem(null)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadCycleData, selectActiveItem, syncFormFromCycle, urlCycleId])

  const activeItem = React.useMemo(
    () => cycle?.items.find((it) => it.id === activeItemId) ?? null,
    [cycle, activeItemId],
  )

  const updateUrlCycle = React.useCallback(
    (id: string) => {
      router.replace(`/periodic-stocktake?cycleId=${encodeURIComponent(id)}`)
    },
    [router],
  )

  const refreshCycleList = React.useCallback(async () => {
    try {
      const res = await listStocktakes({ page: 1, pageSize: 25 })
      setCycles(res.items)
    } catch {
      // non-fatal sidebar/dropdown refresh
    }
  }, [])

  const handleCreateCycle = async () => {
    setCreating(true)
    try {
      const created = await createStocktake({
        zone: selectedZone,
        method: selectedMethod,
        counterName: counterName.trim() || undefined,
        supervisorName: supervisorName.trim() || undefined,
      })
      syncFormFromCycle(created, pickNextPendingItemId(created.items))
      updateUrlCycle(created.id)
      void refreshCycleList()
      toast.success(`دوره انبارگردانی ${created.cycleCode} ایجاد شد.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!cycle) return
    setSavingSettings(true)
    try {
      const updated = await updateStocktake(cycle.id, {
        method: selectedMethod,
        counterName: counterName.trim(),
        supervisorName: supervisorName.trim(),
      })
      syncFormFromCycle(updated, activeItemId)
      void refreshCycleList()
      toast.success('تنظیمات دوره انبارگردانی به‌روزرسانی شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSelectCycle = async (id: string) => {
    updateUrlCycle(id)
    try {
      const loaded = await getStocktake(id)
      syncFormFromCycle(loaded)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleScannerSubmit = () => {
    if (!cycle) return
    const q = scannerQuery.trim()
    if (!q) return
    const match = cycle.items.find((it) => matchesStocktakeSearch(it, q))
    if (!match) {
      toast.warning('قلمی با این بارکد یا نام در دوره فعال یافت نشد.')
      return
    }
    selectActiveItem(match)
    toast.success(`قلم «${match.nameFa}» (${match.batchNo}) انتخاب شد.`)
  }

  const handleSubmitCount = async () => {
    if (!cycle || !activeItem) return
    const qty = parseNonNegativeCount(countInput)
    if (qty === null) {
      toast.error('لطفاً عدد صحیح نامنفی برای شمارش وارد کنید.')
      return
    }
    setSubmittingCount(true)
    try {
      const updated = await recordStocktakeItem(cycle.id, activeItem.id, {
        action: 'count',
        physicalQty: qty,
        varianceReason: reasonInput.trim() || undefined,
      })
      setCycle(updated)
      const nextId = pickNextPendingItemId(updated.items, activeItem.id)
      const nextItem =
        updated.items.find((it) => it.id === nextId) ?? null
      selectActiveItem(nextItem)
      void refreshCycleList()
      toast.success(`شمارش «${activeItem.nameFa}» ثبت شد.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSubmittingCount(false)
    }
  }

  const handleSkipItem = async () => {
    if (!cycle || !activeItem) return
    setSubmittingCount(true)
    try {
      const updated = await recordStocktakeItem(cycle.id, activeItem.id, {
        action: 'skip',
        varianceReason: reasonInput.trim() || 'نیاز به بررسی مجدد در قفسه',
      })
      setCycle(updated)
      const nextId = pickNextPendingItemId(updated.items, activeItem.id)
      const nextItem =
        updated.items.find((it) => it.id === nextId) ?? null
      selectActiveItem(nextItem)
      void refreshCycleList()
      toast.info(`قلم «${activeItem.nameFa}» موقتاً رد شد.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSubmittingCount(false)
    }
  }

  const handleSelectForCount = (item: StocktakeItem) => {
    selectActiveItem(item)
  }

  const handleRecountItem = async (item: StocktakeItem) => {
    if (!cycle) return
    setBusyItemId(item.id)
    try {
      const updated = await recordStocktakeItem(cycle.id, item.id, {
        action: 'recount',
      })
      setCycle(updated)
      const reloadedItem =
        updated.items.find((it) => it.id === item.id) ?? null
      selectActiveItem(reloadedItem)
      void refreshCycleList()
      toast.info(`ردیف «${item.nameFa}» برای شمارش مجدد آماده شد.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusyItemId(null)
    }
  }

  const handleToggleVerifyItem = async (item: StocktakeItem) => {
    if (!cycle) return
    setBusyItemId(item.id)
    try {
      const updated = await recordStocktakeItem(cycle.id, item.id, {
        action: 'verify',
        supervisorVerified: !item.supervisorVerified,
      })
      setCycle(updated)
      void refreshCycleList()
      toast.success(
        !item.supervisorVerified
          ? `مغایرت «${item.nameFa}» توسط ناظر تایید شد.`
          : `تایید ناظر برای «${item.nameFa}» لغو شد.`,
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusyItemId(null)
    }
  }

  const handleExportCsv = async () => {
    if (!cycle) return
    setExporting(true)
    try {
      const { blob, filename } = await exportStocktakeCsv(cycle.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('فایل اکسل انبارگردانی دانلود شد.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const handleConfirmCycle = async () => {
    if (!cycle) return
    setConfirming(true)
    try {
      const confirmed = await confirmStocktake(cycle.id, {
        supervisorName: supervisorName.trim() || cycle.supervisorName,
        supervisorConfirm: supervisorConfirmChecked,
      })
      syncFormFromCycle(confirmed)
      setConfirmDialogOpen(false)
      setSupervisorConfirmChecked(false)
      void refreshCycleList()
      toast.success(
        `سند تعدیل کاردکس با شماره ${confirmed.adjustmentDocNo ?? ''} صادر و ثبت شد.`,
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setConfirming(false)
    }
  }

  const summary = cycle?.summary
  const unverifiedHighCount = React.useMemo(
    () =>
      cycle?.items.filter(
        (it) => it.requiresSupervisor && !it.supervisorVerified,
      ).length ?? 0,
    [cycle],
  )
  const firstDrugId = cycle?.items[0]?.drugId

  return (
    <AppShell
      navItems={getPeriodicStocktakeNavItems('periodic-stocktake')}
      header={{
        searchPlaceholder: 'جستجوی نام دارو، کد ژنریک، بارکد یا شناسه IRC…',
      }}
    >
      <div
        className="flex flex-col gap-space-lg pb-8"
        data-slot="periodic-stocktake"
      >
        <PageHeader
          title={PAGE_TITLE}
          description="مدیریت چرخه‌های انبارگردانی فصلی، کنترل شمارش فیزیکی اقلام دارویی، پایش برخط مغایرت‌های کاردکس با انبار و صدور سیستمی اسناد تعدیل کسری و مازاد با تایید مسئول فنی."
          breadcrumbs={
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">داشبورد</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>انبارگردانی دوره‌ای</BreadcrumbPage>
                </BreadcrumbItem>
                {cycle ? (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <span className="font-latin text-label-md text-text-secondary tabular-nums-data">
                        کد دوره: {cycle.cycleCode}
                      </span>
                    </BreadcrumbItem>
                  </>
                ) : null}
              </BreadcrumbList>
            </Breadcrumb>
          }
          actions={
            cycle ? (
              <div className="flex flex-wrap items-center gap-3 rounded-default border border-border-subtle bg-surface-subtle px-3 py-2">
                <div className="space-y-0.5 text-start">
                  <div className="text-label-sm text-text-muted">وضعیت دوره</div>
                  <div className="flex items-center gap-1.5 text-label-lg text-primary">
                    <Badge
                      variant={
                        cycle.status === 'confirmed' ? 'secondary' : 'default'
                      }
                    >
                      {cycle.status === 'confirmed'
                        ? 'تایید نهایی‌شده'
                        : 'دوره فعال'}
                    </Badge>
                    <span className="font-latin tabular-nums-data">
                      {cycle.cycleCode}
                    </span>
                  </div>
                </div>
                <div className="h-8 w-px bg-border-subtle" aria-hidden />
                <div className="space-y-0.5 text-start">
                  <div className="text-label-sm text-text-muted">تاریخ ایجاد</div>
                  <div className="text-data-tabular text-text-primary tabular-nums-data">
                    {formatJalaliDate(cycle.createdAt)}
                  </div>
                </div>
              </div>
            ) : null
          }
        />

        {loadError ? (
          <AlertBanner
            tone="critical"
            title="خطا در دریافت اطلاعات انبارگردانی"
            description={loadError}
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refreshAll(urlCycleId)}
              >
                تلاش مجدد
              </Button>
            }
          />
        ) : null}

        {cycle?.status === 'confirmed' ? (
          <AlertBanner
            tone="valid"
            title={`سند تعدیل کاردکس ${cycle.adjustmentDocNo ?? ''} صادر و در دفتر ممیزی ثبت شد`}
            description="موجودی کاردکس داروها و بچ‌های انبار مطابق شمارش فیزیکی به‌روزرسانی گردید."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/audit-log">مشاهده لاگ ممیزی</Link>
                </Button>
                {firstDrugId ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      href={`/drug-details-cardex?drugId=${encodeURIComponent(firstDrugId)}`}
                    >
                      کاردکس دارو
                    </Link>
                  </Button>
                ) : null}
              </div>
            }
          />
        ) : null}

        {/* KPI Overview Grid */}
        <section
          aria-label="شاخص‌های دوره انبارگردانی"
          className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4"
        >
          <KpiMetricCard
            title="کل ردیف‌های دارویی هدف"
            value={formatPersianNumber(summary?.totalItems ?? 0)}
            icon="medication"
            tone="primary"
            description={cycle?.zoneLabel ?? 'بخش انتخابی'}
          />
          <KpiMetricCard
            title="شمارش‌شده تا این لحظه"
            value={formatPersianNumber(summary?.countedItems ?? 0)}
            icon="check_circle"
            tone="info"
            delta={{
              label: `${toPersianDigits((summary?.progressPct ?? 0).toFixed(1))}٪ پیشرفت فیزیکی`,
              direction: 'flat',
            }}
          />
          <KpiMetricCard
            title="کسری شمارش (اقلام منفی)"
            value={
              summary && summary.shortageUnits > 0
                ? `${formatPersianNumber(summary.shortageUnits)}- واحد`
                : `${formatPersianNumber(0)} واحد`
            }
            icon="trending_down"
            tone="critical"
            delta={{
              label: `${formatPersianNumber(summary?.shortageItemsCount ?? 0)} قلم دارویی`,
              direction: (summary?.shortageUnits ?? 0) > 0 ? 'down' : 'flat',
            }}
          />
          <KpiMetricCard
            title="مازاد ثبت (اقلام مثبت)"
            value={
              summary && summary.surplusUnits > 0
                ? `${formatPersianNumber(summary.surplusUnits)}+ واحد`
                : `${formatPersianNumber(0)} واحد`
            }
            icon="trending_up"
            tone="valid"
            delta={{
              label: `${formatPersianNumber(summary?.surplusItemsCount ?? 0)} قلم دارویی`,
              direction: (summary?.surplusUnits ?? 0) > 0 ? 'up' : 'flat',
            }}
          />
        </section>

        {loading && !cycle ? (
          <div
            data-slot="stocktake-skeleton"
            className="space-y-6"
            aria-busy="true"
            aria-label="در حال بارگذاری اطلاعات دوره انبارگردانی"
          >
            <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
              <div className="space-y-4 rounded-default border border-border-default bg-card p-6 lg:col-span-5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-32" />
              </div>
              <div className="space-y-4 rounded-default border border-border-default bg-card p-6 lg:col-span-7">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
            <div className="space-y-3 rounded-default border border-border-default bg-card p-6">
              <Skeleton className="h-6 w-48" />
              <div className="space-y-2 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
            <p className="text-center text-body-sm text-text-secondary">
              در حال بارگذاری اطلاعات دوره انبارگردانی…
            </p>
          </div>
        ) : (
          <>
            {/* Split Setup & Live Count Entry */}
            <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
              <CycleSetupCard
                cycle={cycle}
                cycles={cycles}
                selectedZone={selectedZone}
                onZoneChange={setSelectedZone}
                selectedMethod={selectedMethod}
                onMethodChange={setSelectedMethod}
                counterName={counterName}
                onCounterNameChange={setCounterName}
                supervisorName={supervisorName}
                onSupervisorNameChange={setSupervisorName}
                creating={creating}
                savingSettings={savingSettings}
                onCreateCycle={() => void handleCreateCycle()}
                onSaveSettings={() => void handleSaveSettings()}
                onSelectCycle={(id) => void handleSelectCycle(id)}
              />

              <LiveCountTerminal
                cycle={cycle}
                activeItem={activeItem}
                scannerQuery={scannerQuery}
                onScannerQueryChange={setScannerQuery}
                onScannerSubmit={handleScannerSubmit}
                countInput={countInput}
                onCountInputChange={setCountInput}
                reasonInput={reasonInput}
                onReasonInputChange={setReasonInput}
                submitting={submittingCount}
                onSubmitCount={() => void handleSubmitCount()}
                onSkipItem={() => void handleSkipItem()}
              />
            </div>

            {/* Variance Table */}
            <VarianceTableSection
              cycle={cycle}
              activeItemId={activeItemId}
              filter={filter}
              onFilterChange={setFilter}
              searchQuery={tableSearch}
              onSearchQueryChange={setTableSearch}
              busyItemId={busyItemId}
              onSelectForCount={handleSelectForCount}
              onRecountItem={(item) => void handleRecountItem(item)}
              onToggleVerifyItem={(item) => void handleToggleVerifyItem(item)}
            />

            {/* Sticky Bottom Bar */}
            <AdjustmentSummaryBar
              cycle={cycle}
              exporting={exporting}
              confirming={confirming}
              onExportCsv={() => void handleExportCsv()}
              onOpenPrintPreview={() => setPrintOpen(true)}
              onOpenConfirmDialog={() => {
                setSupervisorConfirmChecked(unverifiedHighCount === 0)
                setConfirmDialogOpen(true)
              }}
            />
          </>
        )}
      </div>

      {/* Confirm Final Adjustment Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        tone={unverifiedHighCount > 0 ? 'critical' : 'warning'}
        title="تایید نهایی و صدور سند تعدیل کاردکس"
        confirmLabel="صدور قطعی سند تعدیل"
        cancelLabel="بازبینی مجدد"
        loading={confirming}
        onConfirm={() => void handleConfirmCycle()}
        description={
          cycle ? (
            <div className="space-y-3 text-start">
              <p>
                آیا از صدور قطعی سند تعدیل موجودی برای دوره{' '}
                <strong className="font-latin">{cycle.cycleCode}</strong> با نظارت{' '}
                <strong>{supervisorName}</strong> اطمینان دارید؟
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-default bg-surface-subtle p-3 text-label-sm">
                <div>
                  اقلام شمارش‌شده:{' '}
                  <strong>
                    {formatPersianNumber(cycle.summary.countedItems)} از{' '}
                    {formatPersianNumber(cycle.summary.totalItems)}
                  </strong>
                </div>
                <div>
                  خالص اثر مالی:{' '}
                  <strong>
                    {formatRial(Math.abs(cycle.summary.netVarianceRial))}
                    {cycle.summary.netVarianceRial < 0 ? '-' : ''}
                  </strong>
                </div>
                <div>
                  مجموع کسری:{' '}
                  <strong className="text-status-critical-fg">
                    {formatPersianNumber(cycle.summary.shortageUnits)} واحد
                  </strong>
                </div>
                <div>
                  مجموع مازاد:{' '}
                  <strong className="text-status-valid-fg">
                    {formatPersianNumber(cycle.summary.surplusUnits)} واحد
                  </strong>
                </div>
              </div>
              {unverifiedHighCount > 0 ? (
                <div className="flex items-start gap-2 rounded-default border border-status-critical-fg/30 bg-status-critical-bg/40 p-2.5">
                  <Checkbox
                    id="stocktake-supervisor-confirm"
                    checked={supervisorConfirmChecked}
                    onCheckedChange={(checked) =>
                      setSupervisorConfirmChecked(checked === true)
                    }
                  />
                  <Label
                    htmlFor="stocktake-supervisor-confirm"
                    className="cursor-pointer text-body-sm text-status-critical-fg"
                  >
                    {formatPersianNumber(unverifiedHighCount)} قلم با مغایرت بالای{' '}
                    {formatRial(500000)} توسط ناظر فنی بازبینی و تایید مضاعف می‌گردد.
                  </Label>
                </div>
              ) : null}
            </div>
          ) : null
        }
      />

      {/* Printable Protocol / PDF Preview Dialog */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-4xl p-0 sm:max-w-4xl">
          <DialogTitle className="sr-only">
            پیش‌نمایش صورتجلسه انبارگردانی دوره‌ای
          </DialogTitle>
          {cycle ? (
            <PrintableDocumentPreview
              title="صورتجلسه رسمی انبارگردانی و تعدیل موجودی"
              subtitle="سامانه جامع مدیریت انبار داروخانه · PharmaStock"
              documentTitle={`صورتجلسه دوره ${cycle.cycleCode}`}
              meta={[
                { label: 'کد دوره', value: cycle.cycleCode, dir: 'ltr' },
                {
                  label: 'شماره سند تعدیل',
                  value: cycle.adjustmentDocNo ?? 'پیش‌نویس / در انتظار تایید',
                  dir: 'ltr',
                },
                { label: 'تاریخ', value: formatJalaliDate(cycle.createdAt) },
                { label: 'بخش', value: cycle.zoneLabel },
              ]}
              parties={[
                { label: 'شمارش‌گر ارشد انبار', value: cycle.counterName },
                { label: 'ناظر فنی داروساز', value: cycle.supervisorName },
              ]}
              columns={[
                'نام دارو',
                'سری ساخت',
                'موقعیت',
                'سیستم',
                'فیزیکی',
                'مغایرت',
                'ارزش ریالی',
              ]}
              lines={cycle.items.map((it) => ({
                id: it.id,
                cells: [
                  it.nameFa,
                  it.batchNo,
                  it.locationLabel,
                  it.systemQty != null ? formatPersianNumber(it.systemQty) : 'محرمانه',
                  it.physicalQty != null ? formatPersianNumber(it.physicalQty) : '—',
                  it.varianceQty != null ? formatPersianNumber(it.varianceQty) : '—',
                  it.varianceRial != null ? formatRial(it.varianceRial) : '—',
                ],
              }))}
              totalLabel="خالص اثر مالی مغایرت"
              totalValue={formatRial(cycle.summary.netVarianceRial)}
              footerNote="این صورتجلسه مطابق ضوابط انبارداری دارویی GMP و با تایید مسئول فنی صادر شده است."
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
