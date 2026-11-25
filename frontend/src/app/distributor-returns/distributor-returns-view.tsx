'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout'
import {
  ActionTooltip,
  AlertBanner,
  KpiMetricCard,
  PageHeader,
  TriageStatusBadge,
  type TriageStatus,
} from '@/components/shared'
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
  Checkbox,
  Icon,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui'
import { ApiError } from '@/lib/api/http'
import {
  formatJalaliDate,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'
import {
  confirmDistributorReturn,
  createDistributorReturn,
  fetchEligibleReturns,
  fetchReturns,
  settleDistributorReturn,
} from '@/lib/returns/data-access'
import {
  buildSelectedDistributorDrafts,
  clampReturnQuantity,
  computeGroupSelectionSummary,
  defaultSelectedUrgentBatchIds,
  resolveBatchReturnQty,
  toCreateReturnPayloads,
  type ReturnBatchOverride,
} from '@/lib/returns/selection'
import type {
  DistributorEligibilityResult,
  DistributorReturn,
  DistributorReturnGroup,
  EligibleReturnBatch,
  ReturnSlipStatus,
  ReturnWindowDays,
} from '@/lib/types/returns'
import { cn } from '@/lib/utils'
import { getDistributorReturnsNavItems } from './nav'
import { ReturnSlipModal } from './return-slip-modal'

const PAGE_TITLE = 'مدیریت و صدور مرجوعی دارو به شرکت‌های پخش'

const WINDOW_OPTIONS: Array<{ value: ReturnWindowDays; label: string }> = [
  { value: 90, label: '۳ ماه قبل از تاریخ انقضا (پیش‌فرض قرارداد)' },
  { value: 60, label: '۲ ماه قبل از تاریخ انقضا (توافق پخش سریع)' },
  { value: 120, label: '۴ ماه قبل از تاریخ انقضا (اقلام حساس یخچالی)' },
  { value: 180, label: '۶ ماه قبل از تاریخ انقضا (داروهای خاص و بیمارستانی)' },
]

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.fields && typeof err.fields === 'object') {
      const parts = Object.values(err.fields as Record<string, unknown>).filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      )
      if (parts.length > 0) return parts.join(' ')
    }
    return err.message || 'خطا در ارتباط با سرور'
  }
  if (err instanceof Error && err.message) return err.message
  return 'خطای غیرمنتظره رخ داد.'
}

function batchUrgencyTriage(item: EligibleReturnBatch): {
  status: TriageStatus
  label: string
} {
  if (item.daysUntilExpiry < 0) {
    return {
      status: 'critical',
      label: `منقضی‌شده (${toPersianDigits(Math.abs(item.daysUntilExpiry))} روز قبل)`,
    }
  }
  if (item.daysUntilExpiry <= 25) {
    return {
      status: 'critical',
      label: `${toPersianDigits(item.daysUntilExpiry)} روز مانده تا ممنوعیت`,
    }
  }
  if (item.daysUntilExpiry <= 60) {
    return {
      status: 'expiring',
      label: `${toPersianDigits(item.daysUntilExpiry)} روز مانده به سررسید`,
    }
  }
  if (item.daysUntilExpiry <= 90) {
    return {
      status: 'warning',
      label: `${toPersianDigits(item.daysUntilExpiry)} روز مانده (بازه طلایی)`,
    }
  }
  return {
    status: 'info',
    label: `${toPersianDigits(item.daysUntilExpiry)} روز مانده (پایش فعال)`,
  }
}

function groupDeadlineTone(days: number): TriageStatus {
  if (days < 0 || days <= 25) return 'critical'
  if (days <= 60) return 'expiring'
  return 'info'
}

function slipStatusMeta(status: ReturnSlipStatus): {
  tone: TriageStatus
  label: string
} {
  switch (status) {
    case 'settled':
      return { tone: 'valid', label: 'تسویه‌شده با ویزیتور' }
    case 'confirmed':
      return { tone: 'warning', label: 'منتظر تایید ویزیتور' }
    case 'cancelled':
      return { tone: 'neutral', label: 'لغوشده' }
    default:
      return { tone: 'info', label: 'پیش‌نویس' }
  }
}

export function DistributorReturnsView() {
  const [windowDays, setWindowDays] = React.useState<ReturnWindowDays>(90)
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [distributorFilter, setDistributorFilter] = React.useState('')

  const [eligibility, setEligibility] =
    React.useState<DistributorEligibilityResult | null>(null)
  const [slips, setSlips] = React.useState<DistributorReturn[]>([])
  const [slipFilter, setSlipFilter] = React.useState<'all' | 'confirmed' | 'settled'>('all')

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [overrides, setOverrides] = React.useState<
    Record<string, ReturnBatchOverride>
  >({})
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [hasInitializedSelection, setHasInitializedSelection] =
    React.useState(false)

  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [inspectSlip, setInspectSlip] = React.useState<DistributorReturn | null>(
    null,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const requestIdRef = React.useRef(0)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadData = React.useCallback(
    async (opts?: { resetSelection?: boolean }) => {
      const reqId = ++requestIdRef.current
      setLoading(true)
      setError(null)
      try {
        const [eligRes, slipsRes] = await Promise.all([
          fetchEligibleReturns({
            windowDays,
            search,
            distributorId: distributorFilter || undefined,
          }),
          fetchReturns({ page: 1, pageSize: 20 }),
        ])
        if (reqId !== requestIdRef.current) return
        setEligibility(eligRes)
        setSlips(slipsRes.items)

        const validIds = new Set<string>()
        for (const grp of eligRes.groups) {
          for (const item of grp.items) {
            validIds.add(item.batchId)
          }
        }

        if (opts?.resetSelection || !hasInitializedSelection) {
          setSelectedIds(defaultSelectedUrgentBatchIds(eligRes.groups))
          setHasInitializedSelection(true)
        } else {
          setSelectedIds((prev) => {
            const next = new Set<string>()
            for (const id of prev) {
              if (validIds.has(id)) next.add(id)
            }
            return next
          })
        }
      } catch (err) {
        if (reqId !== requestIdRef.current) return
        setError(errorMessage(err))
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [windowDays, search, distributorFilter, hasInitializedSelection],
  )

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

  const groups = React.useMemo(
    () => eligibility?.groups ?? [],
    [eligibility],
  )

  const allBatchIds = React.useMemo(() => {
    const ids: string[] = []
    for (const grp of groups) {
      for (const item of grp.items) {
        ids.push(item.batchId)
      }
    }
    return ids
  }, [groups])

  const allSelected =
    allBatchIds.length > 0 && allBatchIds.every((id) => selectedIds.has(id))

  const selectedDrafts = React.useMemo(
    () => buildSelectedDistributorDrafts(groups, selectedIds, overrides),
    [groups, selectedIds, overrides],
  )

  const selectedItemCount = selectedIds.size
  const selectedTotalValue = React.useMemo(
    () => selectedDrafts.reduce((sum, d) => sum + d.totalValueRial, 0),
    [selectedDrafts],
  )

  const visibleSlips = React.useMemo(() => {
    if (slipFilter === 'all') return slips
    return slips.filter((s) => s.status === slipFilter)
  }, [slips, slipFilter])

  const toggleItem = React.useCallback((batchId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(batchId)
      else next.delete(batchId)
      return next
    })
  }, [])

  const toggleGroup = React.useCallback(
    (group: DistributorReturnGroup, checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const item of group.items) {
          if (checked) next.add(item.batchId)
          else next.delete(item.batchId)
        }
        return next
      })
    },
    [],
  )

  const toggleSelectAll = React.useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allBatchIds))
    }
  }, [allSelected, allBatchIds])

  const toggleCollapse = React.useCallback((distId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(distId)) next.delete(distId)
      else next.add(distId)
      return next
    })
  }, [])

  const updateBatchQty = React.useCallback(
    (batch: EligibleReturnBatch, rawValue: string) => {
      const parsed = Number(rawValue)
      const clamped = clampReturnQuantity(
        Number.isNaN(parsed) ? 1 : parsed,
        batch.quantity,
      )
      setOverrides((prev) => ({
        ...prev,
        [batch.batchId]: {
          ...prev[batch.batchId],
          quantity: clamped,
        },
      }))
    },
    [],
  )

  const openIssuePreview = React.useCallback(() => {
    if (selectedDrafts.length === 0) {
      toast.warning('حداقل یک سری ساخت را برای صدور برگه مرجوعی انتخاب کنید.')
      return
    }
    setInspectSlip(null)
    setPreviewOpen(true)
  }, [selectedDrafts.length])

  const handleConfirmIssue = React.useCallback(
    async (note: string) => {
      if (selectedDrafts.length === 0) return
      setSubmitting(true)
      try {
        const payloads = toCreateReturnPayloads(
          selectedDrafts,
          windowDays,
          note,
        )
        const issued: DistributorReturn[] = []
        for (const payload of payloads) {
          const draft = await createDistributorReturn(payload)
          const confirmed = await confirmDistributorReturn(draft.id)
          issued.push(confirmed)
        }

        const slipNumbers = issued
          .map((s) => s.returnNo)
          .filter(Boolean)
          .join('، ')
        toast.success(
          issued.length === 1
            ? `برگه مرجوعی ${slipNumbers} با موفقیت صادر و از کاردکس کسر شد.`
            : `${toPersianDigits(issued.length)} برگه مرجوعی (${slipNumbers}) صادر و از کاردکس کسر شد.`,
        )
        setPreviewOpen(false)
        setOverrides({})
        await loadData({ resetSelection: true })
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setSubmitting(false)
      }
    },
    [selectedDrafts, windowDays, loadData],
  )

  const handleSettleSlip = React.useCallback(
    async (
      id: string,
      payload: { visitorName?: string; creditNoteNo?: string },
    ) => {
      setSubmitting(true)
      try {
        const settled = await settleDistributorReturn(id, payload)
        toast.success(
          `برگه مرجوعی ${settled.returnNo ?? ''} توسط ویزیتور تایید و تسویه شد.`,
        )
        setPreviewOpen(false)
        setInspectSlip(null)
        await loadData()
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setSubmitting(false)
      }
    },
    [loadData],
  )

  const kpis = eligibility?.kpis
  const todayISO = eligibility?.todayISO || new Date().toISOString().slice(0, 10)

  return (
    <AppShell navItems={getDistributorReturnsNavItems('distributor-returns')}>
      <div
        data-slot="distributor-returns"
        className="flex flex-col gap-space-lg"
      >
        <PageHeader
          title={PAGE_TITLE}
          description="پایش خودکار بچ‌های واردشده به بازه مجاز مرجوعی قراردادی، تجمیع اقلام و صدور حواله و صورت‌جلسه رسمی بازگشت کالا"
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
                  <BreadcrumbPage>مرجوعی به شرکت‌های پخش</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-default border border-border-default bg-surface-subtle px-3 py-1.5">
                <Icon
                  name="timelapse"
                  size={18}
                  className="text-primary"
                  data-slot="icon"
                />
                <span className="text-label-sm text-text-secondary">
                  بازه هوشمند مرجوعی:
                </span>
                <Select
                  value={String(windowDays)}
                  onValueChange={(val) =>
                    setWindowDays(Number(val) as ReturnWindowDays)
                  }
                >
                  <SelectTrigger
                    id="return-window-select"
                    size="sm"
                    className="h-8 w-auto min-w-[230px] border-0 bg-transparent px-1 font-semibold text-primary shadow-none"
                    aria-label="تنظیم بازه هوشمند مرجوعی"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                id="issue-return-slip-btn"
                disabled={selectedItemCount === 0 || loading}
                onClick={openIssuePreview}
              >
                <Icon name="print" size={18} data-slot="icon" />
                <span>
                  صدور برگه مرجوعی ({toPersianDigits(selectedItemCount)} قلم
                  انتخاب‌شده)
                </span>
              </Button>
            </div>
          }
        />

        <AlertBanner
          tone={kpis && kpis.urgentBatches > 0 ? 'warning' : 'valid'}
          title="بند رسمی ماده ۴ قرارداد استرداد شرکت‌های پخش"
          description={`تضمین استرداد ۱۰۰٪ ارزش فاکتور خرید پیش از ورود به بازه ممنوعیت. تاریخ تقویمی امروز: ${formatJalaliDate(todayISO)} • بچ‌های نیازمند اقدام فوری (≤ ۲۵ روز): ${toPersianDigits(kpis?.urgentBatches ?? 0)} مورد`}
          action={
            selectedItemCount > 0 ? (
              <span className="text-label-sm font-semibold text-current">
                جمع مبلغ انتخاب‌شده فعلی: {formatRial(selectedTotalValue)}
              </span>
            ) : undefined
          }
        />

        {/* KPI Dashboard */}
        <section
          aria-label="شاخص‌های کلیدی مرجوعی به پخش"
          className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4"
        >
          <KpiMetricCard
            title="کل سری‌های ساخت در بازه"
            value={toPersianDigits(kpis?.totalBatches ?? 0)}
            icon="inventory_2"
            tone={kpis && kpis.urgentBatches > 0 ? 'critical' : 'primary'}
            description="بچ دارویی واجد شرایط مرجوعی"
            delta={{
              label: `${toPersianDigits(kpis?.urgentBatches ?? 0)} قلم زیر ۲۵ روز تا ممنوعیت`,
              direction: kpis && kpis.urgentBatches > 0 ? 'down' : 'flat',
            }}
          />
          <KpiMetricCard
            title="ارزش ریالی اقلام قابل استرداد"
            value={formatRial(kpis?.totalValueRial ?? 0, {
              withCurrency: false,
            })}
            icon="price_check"
            tone="valid"
            description="مبنای محاسبه: فی خرید فاکتور (ریال)"
            delta={{
              label: 'تضمین جلوگیری از ضرر قطعی داروخانه',
              direction: 'up',
            }}
          />
          <KpiMetricCard
            title="شرکت‌های پخش در فرآیند"
            value={toPersianDigits(kpis?.activeDistributors ?? 0)}
            icon="local_shipping"
            tone="info"
            description={
              kpis?.distributorNames && kpis.distributorNames.length > 0
                ? kpis.distributorNames.join('، ')
                : 'موردی در بازه فعلی ثبت نشده'
            }
          />
          <KpiMetricCard
            title="حواله‌های منتظر تایید ویزیتور"
            value={toPersianDigits(kpis?.pendingVisitorSlips ?? 0)}
            icon="pending_actions"
            tone={
              kpis && kpis.pendingVisitorSlips > 0 ? 'warning' : 'neutral'
            }
            description="فقره صورت‌جلسه باز در انتظار تسویه"
            delta={{
              label:
                kpis && kpis.pendingVisitorSlips > 0
                  ? 'نیاز به ثبت تاییدیه نماینده پخش'
                  : 'تمام حواله‌ها تسویه شده‌اند',
              direction: 'flat',
            }}
          />
        </section>

        {/* Toolbar */}
        <section className="flex flex-col gap-3 rounded-default border border-border-default bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted"
                data-slot="icon"
              />
              <Input
                id="returns-search-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="جستجوی نام دارو، سری ساخت، IRC یا شرکت پخش…"
                className="ps-9"
              />
            </div>

            <Select
              value={distributorFilter || '__all__'}
              onValueChange={(val) =>
                setDistributorFilter(val === '__all__' ? '' : val)
              }
            >
              <SelectTrigger
                id="returns-distributor-filter"
                className="w-full sm:w-[220px]"
                aria-label="فیلتر شرکت پخش"
              >
                <SelectValue placeholder="همه شرکت‌های پخش" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">همه شرکت‌های پخش</SelectItem>
                <SelectItem value="daroupakhsh">شرکت توزیع داروپخش</SelectItem>
                <SelectItem value="hejrat">شرکت پخش هجرت</SelectItem>
                <SelectItem value="razi">شرکت پخش رازی</SelectItem>
                <SelectItem value="alborz">شرکت پخش البرز</SelectItem>
                <SelectItem value="ferdows">شرکت پخش فردوس</SelectItem>
                <SelectItem value="abidi">پخش داروسازی عبیدی</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="select-all-eligible-btn"
              disabled={allBatchIds.length === 0}
              onClick={toggleSelectAll}
            >
              <Icon
                name={allSelected ? 'clear_all' : 'done_all'}
                size={16}
                data-slot="icon"
              />
              <span>
                {allSelected
                  ? 'لغو انتخاب همه اقلام'
                  : 'انتخاب تمام اقلام واجد شرایط'}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
            >
              <Icon
                name="refresh"
                size={16}
                className={cn(loading && 'animate-spin')}
                data-slot="icon"
              />
              <span>بروزرسانی</span>
            </Button>
          </div>
        </section>

        {/* Groups List */}
        <section className="flex flex-col gap-space-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-title-md text-text-primary">
                تفکیک اقلام بر اساس شرکت‌های پخش طرف قرارداد
              </h2>
              <span className="text-label-sm text-text-secondary">
                (آماده‌سازی دسته‌ای جهت تطبیق فاکتور و تحویل به موزعین)
              </span>
            </div>
          </div>

          {error ? (
            <AlertBanner
              tone="critical"
              title="خطا در دریافت لیست اقلام مرجوعی"
              description={error}
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadData()}
                >
                  تلاش مجدد
                </Button>
              }
            />
          ) : null}

          {loading && !eligibility ? (
            <div
              data-slot="distributor-returns-skeleton"
              className="space-y-6"
              aria-busy="true"
              aria-label="در حال پایش سری‌های ساخت واجد شرایط مرجوعی"
            >
              <div className="space-y-3 rounded-default border border-border-default bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="h-9 w-32" />
                </div>
                <div className="space-y-2 pt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </div>
              <p className="text-center text-body-sm text-text-secondary">
                در حال پایش سری‌های ساخت واجد شرایط مرجوعی…
              </p>
            </div>
          ) : null}

          {!loading && !error && groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
                  <Icon name="inventory_2" size={26} data-slot="icon" />
                </span>
                <p className="text-title-sm text-text-primary">
                  هیچ بچ واجد شرایطی در بازه {toPersianDigits(windowDays)} روزه
                  یافت نشد
                </p>
                <p className="max-w-md text-body-sm text-text-secondary">
                  می‌توانید بازه هوشمند مرجوعی را افزایش دهید یا از صفحه هشدارهای
                  انقضا، سری‌های ساخت مورد نظر را جهت پیگیری مرجوعی علامت‌گذاری
                  کنید.
                </p>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {windowDays < 180 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWindowDays(180)}
                    >
                      گسترش بازه به ۶ ماه (۱۸۰ روز)
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href="/expiry-alerts-fefo">
                      مشاهده هشدارهای انقضا و FEFO
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {groups.map((group) => {
            const summary = computeGroupSelectionSummary(
              group,
              selectedIds,
              overrides,
            )
            const isCollapsed = collapsedGroups.has(group.distributorId)
            const deadlineStatus = groupDeadlineTone(group.nearestDays)

            return (
              <Card
                key={group.distributorId}
                data-slot="distributor-return-group"
                data-distributor-id={group.distributorId}
                className="overflow-hidden p-0"
              >
                {/* Group Header Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-subtle px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={
                        summary.allSelected
                          ? true
                          : summary.someSelected
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(checked) =>
                        toggleGroup(group, Boolean(checked))
                      }
                      aria-label={`انتخاب همه اقلام ${group.distributorName}`}
                    />
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-default border border-border-default bg-surface text-primary">
                      <Icon name="domain" size={20} data-slot="icon" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-title-md text-text-primary">
                          {group.distributorName}
                        </h3>
                        <Badge variant="neutral" dir="ltr" className="font-latin">
                          کد موزع: {group.distributorCode}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-4 text-label-sm text-text-secondary">
                        <span>
                          تعداد بچ قابل مرجوع:{' '}
                          <strong className="tabular-nums-data text-text-primary">
                            {toPersianDigits(group.batchCount)} سری ساخت
                          </strong>
                        </span>
                        <span>
                          جمع ارزش استرداد:{' '}
                          <strong className="tabular-nums-data text-primary">
                            {formatRial(group.totalValueRial)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TriageStatusBadge status={deadlineStatus}>
                      {group.nearestDays < 0
                        ? `دارای قلم منقضی (اقدام فوری)`
                        : `نزدیک‌ترین سررسید: تا ${toPersianDigits(group.nearestDays)} روز دیگر (${formatJalaliDate(group.nearestExpiry)})`}
                    </TriageStatusBadge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        isCollapsed
                          ? `باز کردن جدول ${group.distributorName}`
                          : `بستن جدول ${group.distributorName}`
                      }
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleCollapse(group.distributorId)}
                    >
                      <Icon
                        name={isCollapsed ? 'expand_more' : 'expand_less'}
                        size={20}
                        data-slot="icon"
                      />
                    </Button>
                  </div>
                </div>

                {/* Dense Table */}
                {!isCollapsed ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-body-sm">
                      <thead>
                        <tr className="border-b border-border-subtle bg-surface-muted/60 text-label-md text-text-secondary">
                          <th className="w-12 px-4 py-2.5 text-center">
                            انتخاب
                          </th>
                          <th className="px-4 py-2.5 text-start">
                            نام ژنریک و شرکت سازنده
                          </th>
                          <th className="px-4 py-2.5 text-start">
                            کد IRC و سری ساخت
                          </th>
                          <th className="px-4 py-2.5 text-start">
                            تاریخ انقضا و بازه
                          </th>
                          <th className="px-4 py-2.5 text-center">
                            تعداد مرجوعی
                          </th>
                          <th className="px-4 py-2.5 text-end">
                            فی خرید (ریال)
                          </th>
                          <th className="px-4 py-2.5 text-end">
                            مبلغ کل استرداد
                          </th>
                          <th className="px-4 py-2.5 text-start">
                            علت مرجوعی قراردادی
                          </th>
                          <th className="px-4 py-2.5 text-center">کاردکس</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {group.items.map((item) => {
                          const isChecked = selectedIds.has(item.batchId)
                          const qty = resolveBatchReturnQty(item, overrides)
                          const lineTotal = qty * item.buyPriceRial
                          const triage = batchUrgencyTriage(item)

                          return (
                            <tr
                              key={item.batchId}
                              data-batch-id={item.batchId}
                              className={cn(
                                'transition-colors hover:bg-surface-hover/50',
                                isChecked && 'bg-primary-tint/20',
                              )}
                            >
                              <td className="px-4 py-3 text-center">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) =>
                                    toggleItem(item.batchId, Boolean(checked))
                                  }
                                  aria-label={`انتخاب ${item.nameFa} بچ ${item.batchNo}`}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-text-primary">
                                    {item.nameFa}
                                  </span>
                                  {item.isControlled ? (
                                    <Badge variant="critical">تحت کنترل</Badge>
                                  ) : null}
                                  {item.status === 'marked_return' ? (
                                    <Badge variant="info">نشان‌شده</Badge>
                                  ) : null}
                                </div>
                                <div className="mt-0.5 text-label-sm text-text-secondary">
                                  {[
                                    item.manufacturer,
                                    item.dosageForm,
                                    item.strength,
                                  ]
                                    .filter(Boolean)
                                    .join(' • ') || '—'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div
                                  dir="ltr"
                                  className="font-latin text-start font-semibold text-text-primary tabular-nums-data"
                                >
                                  {item.batchNo}
                                </div>
                                <div
                                  dir="ltr"
                                  className="font-latin text-start text-label-sm text-text-secondary tabular-nums-data"
                                >
                                  IRC: {item.irc || '—'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="mb-1 text-label-md font-semibold text-text-primary tabular-nums-data">
                                  {formatJalaliDate(item.expiry)}
                                </div>
                                <TriageStatusBadge status={triage.status}>
                                  {triage.label}
                                </TriageStatusBadge>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex flex-col items-center gap-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={item.quantity}
                                    value={qty}
                                    onChange={(e) =>
                                      updateBatchQty(item, e.target.value)
                                    }
                                    aria-label={`تعداد مرجوعی ${item.nameFa} بچ ${item.batchNo}`}
                                    className="h-8 w-20 text-center tabular-nums-data"
                                  />
                                  <span className="text-label-sm text-text-secondary">
                                    از {toPersianDigits(item.quantity)}{' '}
                                    {item.unitLabel}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-end text-text-secondary tabular-nums-data">
                                {formatRial(item.buyPriceRial, {
                                  withCurrency: false,
                                })}
                              </td>
                              <td className="px-4 py-3 text-end font-bold text-primary tabular-nums-data">
                                {formatRial(lineTotal)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-block max-w-xs rounded-default bg-surface-subtle px-2.5 py-1 text-label-sm text-text-secondary">
                                  {item.contractReason}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  asChild
                                  title="سوابق گردش بچ در کاردکس"
                                >
                                  <Link
                                    href={`/drug-details-cardex?drugId=${encodeURIComponent(item.drugId)}`}
                                    aria-label={`مشاهده کاردکس ${item.nameFa}`}
                                  >
                                    <Icon
                                      name="history"
                                      size={18}
                                      data-slot="icon"
                                    />
                                  </Link>
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {/* Distributor Subtotal Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-surface-subtle px-5 py-3 text-label-md text-text-secondary">
                  <span>موقعیت دپوی فیزیکی: {group.depositLocation}</span>
                  <div className="flex flex-wrap items-center gap-4 tabular-nums-data">
                    <span>
                      ردیف‌های انتخابی این شرکت:{' '}
                      <strong className="text-text-primary">
                        {toPersianDigits(summary.selectedCount)} قلم (
                        {toPersianDigits(summary.totalQty)} عدد)
                      </strong>
                    </span>
                    <span>
                      جمع مبلغ ریالی:{' '}
                      <strong className="text-primary">
                        {formatRial(summary.totalValueRial)}
                      </strong>
                    </span>
                  </div>
                </div>
              </Card>
            )
          })}
        </section>

        {/* Issued Return Slips History */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-title-md text-text-primary">
                حواله‌ها و صورت‌جلسه‌های مرجوعی صادرشده
              </h2>
              <p className="text-label-sm text-text-secondary">
                پیگیری وضعیت دریافت توسط ویزیتور شرکت پخش و ثبت شماره اعلامیه
                بستانکاری
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'همه' },
                  { id: 'confirmed', label: 'منتظر تایید ویزیتور' },
                  { id: 'settled', label: 'تسویه‌شده' },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  size="sm"
                  variant={slipFilter === tab.id ? 'default' : 'outline'}
                  onClick={() => setSlipFilter(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          {visibleSlips.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-body-sm text-text-secondary">
                هنوز برگه مرجوعی‌ای در این وضعیت صادر نشده است.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-body-sm">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-muted/60 text-label-md text-text-secondary">
                      <th className="px-4 py-2.5 text-start">شماره حواله</th>
                      <th className="px-4 py-2.5 text-start">شرکت پخش</th>
                      <th className="px-4 py-2.5 text-center">تعداد کل</th>
                      <th className="px-4 py-2.5 text-end">مبلغ استرداد</th>
                      <th className="px-4 py-2.5 text-start">تاریخ صدور</th>
                      <th className="px-4 py-2.5 text-start">وضعیت</th>
                      <th className="px-4 py-2.5 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {visibleSlips.map((slip) => {
                      const meta = slipStatusMeta(slip.status)
                      return (
                        <tr
                          key={slip.id}
                          data-slip-id={slip.id}
                          className="hover:bg-surface-hover/50"
                        >
                          <td
                            dir="ltr"
                            className="px-4 py-3 text-start font-latin font-semibold text-text-primary tabular-nums-data"
                          >
                            {slip.returnNo || slip.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-text-primary">
                              {slip.distributorName}
                            </div>
                            {slip.creditNoteNo ? (
                              <div className="text-label-sm text-text-secondary">
                                بستانکاری: {slip.creditNoteNo}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums-data">
                            {toPersianDigits(slip.totalQty)} (
                            {toPersianDigits(slip.lines.length)} ردیف)
                          </td>
                          <td className="px-4 py-3 text-end font-semibold text-primary tabular-nums-data">
                            {formatRial(slip.totalValueRial)}
                          </td>
                          <td className="px-4 py-3 tabular-nums-data">
                            {formatJalaliDate(
                              slip.confirmedAt || slip.createdAt,
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <TriageStatusBadge status={meta.tone}>
                              {meta.label}
                            </TriageStatusBadge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ActionTooltip title="مشاهده و چاپ حواله استرداد">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setInspectSlip(slip)
                                  setPreviewOpen(true)
                                }}
                              >
                                <Icon name="visibility" size={16} data-slot="icon" />
                                <span>
                                  {slip.status === 'confirmed'
                                    ? 'پیش‌نمایش / تایید ویزیتور'
                                    : 'مشاهده و چاپ'}
                                </span>
                              </Button>
                            </ActionTooltip>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </div>

      <ReturnSlipModal
        open={previewOpen}
        onOpenChange={(next) => {
          setPreviewOpen(next)
          if (!next) setInspectSlip(null)
        }}
        drafts={inspectSlip ? [] : selectedDrafts}
        todayISO={todayISO}
        submitting={submitting}
        onConfirmIssue={handleConfirmIssue}
        existingSlip={inspectSlip}
        onSettleSlip={handleSettleSlip}
      />
    </AppShell>
  )
}
