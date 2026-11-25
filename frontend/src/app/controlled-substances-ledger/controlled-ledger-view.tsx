'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import {
  AlertBanner,
  DenseDataTable,
  KpiMetricCard,
  Pagination,
  TriageStatusBadge,
  type DenseColumn,
  type TriageStatus,
} from '@/components/shared'
import { getSessionUser } from '@/lib/api/session'
import { resolveJalaliDateRange, type DateRangePreset } from '@/lib/audit/jalali-range'
import {
  createControlledLedgerEntry,
  exportControlledLedgerFile,
  exportControlledLedgerPdf,
  fetchControlledLedger,
  type ControlledLedgerQuery,
} from '@/lib/controlled/data-access'
import { getAuditRoleLabel } from '@/lib/domain/auditEvents'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatPersianTime,
  toPersianDigits,
} from '@/lib/persian'
import type {
  ControlledKpis,
  ControlledLedgerEntry,
  ControlledTxType,
  CreateControlledEntryInput,
  VaultBinOption,
  VaultDrugStock,
} from '@/lib/types/controlled'
import { ControlledRegisterDialog } from './controlled-register-dialog'
import { ControlledRegulatoryPanel } from './controlled-regulatory-panel'
import { getControlledNavItems } from './nav'

type DateFilter = 'all' | Exclude<DateRangePreset, 'custom'>

type LoadState = 'loading' | 'ready' | 'error'

const SEARCH_DEBOUNCE_MS = 300
const emptySubscribe = () => () => {}

const TX_BADGE_STATUS: Record<ControlledTxType, TriageStatus> = {
  in_distributor: 'valid',
  out_prescription: 'critical',
  waste_return: 'warning',
}

const TX_TYPE_LABELS: Record<ControlledTxType, string> = {
  in_distributor: 'ورود از پخش سهمیه‌ای (+)',
  out_prescription: 'تحویل به بیمار با نسخه (-)',
  waste_return: 'امحا و مرجوعی پوکه',
}

const DATE_LABELS: Record<DateFilter, string> = {
  all: 'همه تاریخ‌ها',
  today: 'امروز',
  week: '۷ روز گذشته',
  month: 'ماه جاری',
  last30: '۳۰ روز گذشته',
}

const EMPTY_KPIS: ControlledKpis = {
  totalVaultBalance: 0,
  controlledDrugCount: 0,
  monthInflow: 0,
  monthInflowShipments: 0,
  monthOutflow: 0,
  activePrescriptionCount: 0,
  wasteDestroyedCount: 0,
  totalEntries: 0,
  reconciliationPct: 100,
}

export function ControlledLedgerView() {
  const router = useRouter()
  const [loadState, setLoadState] = React.useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = React.useState('')

  const [entries, setEntries] = React.useState<ControlledLedgerEntry[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)
  const [pageCount, setPageCount] = React.useState(1)
  const [kpis, setKpis] = React.useState<ControlledKpis>(EMPTY_KPIS)
  const [vaultItems, setVaultItems] = React.useState<VaultDrugStock[]>([])
  const [vaultBins, setVaultBins] = React.useState<VaultBinOption[]>([])

  const [drugFilter, setDrugFilter] = React.useState('all')
  const [txTypeFilter, setTxTypeFilter] = React.useState<'all' | ControlledTxType>('all')
  const [dateFilter, setDateFilter] = React.useState<DateFilter>('all')
  const [searchInput, setSearchInput] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  const sessionUser = React.useMemo(
    () => (mounted ? getSessionUser() : null),
    [mounted],
  )
  const operatorName = sessionUser?.name || 'دکتر محمدرضا رضایی'
  const operatorRoleLabel = sessionUser?.role
    ? getAuditRoleLabel(sessionUser.role)
    : 'مسئول فنی داروخانه'

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const activeQuery = React.useMemo<ControlledLedgerQuery>(() => {
    let from: string | undefined
    let to: string | undefined
    if (dateFilter !== 'all') {
      const resolved = resolveJalaliDateRange({ preset: dateFilter })
      if (resolved.ok) {
        from = resolved.range.startIso
        to = resolved.range.endIso
      }
    }
    return {
      drugId: drugFilter === 'all' ? undefined : drugFilter,
      txType: txTypeFilter === 'all' ? undefined : txTypeFilter,
      from,
      to,
      search: debouncedSearch || undefined,
      page,
      pageSize,
      sortBy: 'timestamp',
      sortDir: 'desc',
    }
  }, [drugFilter, txTypeFilter, dateFilter, debouncedSearch, page, pageSize])

  const loadLedger = React.useCallback(async () => {
    setLoadState('loading')
    setErrorMessage('')
    try {
      const res = await fetchControlledLedger(activeQuery)
      setEntries(res.items)
      setTotal(res.total)
      setPageCount(Math.max(1, res.pageCount))
      setKpis(res.kpis)
      setVaultItems(res.vaultItems)
      setVaultBins(res.vaultBins)
      setLoadState('ready')
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'دریافت ردیف‌های دفترچه با خطا مواجه شد.',
      )
      setLoadState('error')
    }
  }, [activeQuery])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      await loadLedger()
    })()
    return () => {
      cancelled = true
    }
  }, [loadLedger])

  const handleRegister = async (input: CreateControlledEntryInput) => {
    const created = await createControlledLedgerEntry(input)
    toast.success(
      `ردیف شماره ${toPersianDigits(created.seqNo)} در دفترچه ثبت و با امضای مسئول فنی پلمب شد.`,
    )
    setPage(1)
    await loadLedger()
  }

  const handleExportFile = async (format: 'csv' | 'json') => {
    setExporting(true)
    try {
      await exportControlledLedgerFile(activeQuery, format)
      toast.success(
        format === 'csv'
          ? 'خروجی CSV دفترچه دریافت شد.'
          : 'خروجی JSON دفترچه دریافت شد.',
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'دریافت خروجی ناموفق بود.',
      )
    } finally {
      setExporting(false)
    }
  }

  const handleClearFilters = () => {
    setDrugFilter('all')
    setTxTypeFilter('all')
    setDateFilter('all')
    setSearchInput('')
    setDebouncedSearch('')
    setPage(1)
  }

  const activeChips = React.useMemo(() => {
    const chips: Array<{ id: string; label: string; clear: () => void }> = []
    if (drugFilter !== 'all') {
      const drugName =
        vaultItems.find((item) => item.drugId === drugFilter)?.nameFa ??
        drugFilter
      chips.push({
        id: 'drug',
        label: `فرآورده: ${drugName}`,
        clear: () => {
          setDrugFilter('all')
          setPage(1)
        },
      })
    }
    if (txTypeFilter !== 'all') {
      chips.push({
        id: 'txType',
        label: `گردش: ${TX_TYPE_LABELS[txTypeFilter]}`,
        clear: () => {
          setTxTypeFilter('all')
          setPage(1)
        },
      })
    }
    if (dateFilter !== 'all') {
      chips.push({
        id: 'date',
        label: `بازه: ${DATE_LABELS[dateFilter]}`,
        clear: () => {
          setDateFilter('all')
          setPage(1)
        },
      })
    }
    if (debouncedSearch) {
      chips.push({
        id: 'search',
        label: `جستجو: ${debouncedSearch}`,
        clear: () => {
          setSearchInput('')
          setDebouncedSearch('')
          setPage(1)
        },
      })
    }
    return chips
  }, [drugFilter, txTypeFilter, dateFilter, debouncedSearch, vaultItems])

  const columns = React.useMemo<DenseColumn<ControlledLedgerEntry>[]>(
    () => [
      {
        id: 'seqNo',
        header: 'ردیف',
        cell: (row) => (
          <span className="tabular-nums-data font-medium text-text-secondary">
            {toPersianDigits(String(row.seqNo).padStart(2, '0'))}
          </span>
        ),
      },
      {
        id: 'timestamp',
        header: 'زمان ثبت شمسی',
        cell: (row) => (
          <div className="whitespace-nowrap">
            <div className="tabular-nums-data font-medium text-text-primary">
              {formatJalaliDate(row.timestamp)}
            </div>
            <div className="tabular-nums-data text-label-sm text-text-secondary">
              {formatPersianTime(row.timestamp)}
            </div>
          </div>
        ),
      },
      {
        id: 'drug',
        header: 'فرآورده و دوز',
        cell: (row) => (
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-text-primary">
              <span
                className={
                  row.txType === 'in_distributor'
                    ? 'size-2 shrink-0 rounded-full bg-status-valid-fg'
                    : 'size-2 shrink-0 rounded-full bg-status-critical-fg'
                }
                aria-hidden
              />
              <span>{row.drugNameFa}</span>
            </div>
            <div className="pr-3.5 text-label-sm text-text-secondary">
              {row.dosageStrength || row.manufacturer || '—'}
            </div>
          </div>
        ),
      },
      {
        id: 'batchNo',
        header: 'سری ساخت',
        dir: 'ltr',
        cell: (row) => (
          <Badge variant="secondary" className="font-latin tabular-nums-data">
            {row.batchNo}
          </Badge>
        ),
      },
      {
        id: 'txType',
        header: 'نوع گردش',
        cell: (row) => (
          <TriageStatusBadge status={TX_BADGE_STATUS[row.txType]}>
            {row.txSubLabel}
          </TriageStatusBadge>
        ),
      },
      {
        id: 'qtyIn',
        header: 'ورود (+)',
        align: 'end',
        cell: (row) =>
          row.qtyIn > 0 ? (
            <span className="tabular-nums-data font-bold text-status-valid-fg">
              +{formatPersianNumber(row.qtyIn)} {row.unitLabel}
            </span>
          ) : (
            <span className="text-text-secondary">—</span>
          ),
      },
      {
        id: 'qtyOut',
        header: 'خروج (-)',
        align: 'end',
        cell: (row) =>
          row.qtyOut > 0 ? (
            <span className="tabular-nums-data font-bold text-status-critical-fg">
              -{formatPersianNumber(row.qtyOut)} {row.unitLabel}
            </span>
          ) : row.ampouleWasteCount > 0 ? (
            <span className="tabular-nums-data font-medium text-status-warning-fg">
              پوکه {formatPersianNumber(row.ampouleWasteCount)}
            </span>
          ) : (
            <span className="text-text-secondary">—</span>
          ),
      },
      {
        id: 'balanceAfter',
        header: 'مانده گاوصندوق',
        align: 'end',
        cell: (row) => (
          <span className="inline-block rounded-md bg-surface-muted px-2 py-1 tabular-nums-data font-bold text-primary">
            {formatPersianNumber(row.balanceAfter)} {row.unitLabel}
          </span>
        ),
      },
      {
        id: 'physician',
        header: 'پزشک معالج / مرکز',
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        cell: (row) => (
          <div>
            <div className="font-medium text-text-primary">
              {row.physicianName || '—'}
            </div>
            {row.physicianLicense ? (
              <div className="text-label-sm text-text-secondary">
                {row.physicianLicense}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'patient',
        header: 'کدملی بیمار / شرح',
        className: 'hidden xl:table-cell',
        headerClassName: 'hidden xl:table-cell',
        cell: (row) => (
          <div>
            <div dir="ltr" className="font-latin tabular-nums-data text-text-primary">
              {row.patientNationalIdMasked || '—'}
            </div>
            {row.patientNote ? (
              <div className="max-w-[12rem] truncate text-label-sm text-text-secondary">
                {row.patientNote}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'tracking',
        header: 'شناسه TTAC / سپاس',
        cell: (row) => (
          <div>
            <div dir="ltr" className="font-latin tabular-nums-data font-medium text-primary">
              {row.trackingCode}
            </div>
            {row.sepasCode ? (
              <div className="tabular-nums-data text-label-sm text-text-secondary">
                سپاس: {toPersianDigits(row.sepasCode)}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'signedBy',
        header: 'تایید و امضا',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <div className="inline-flex items-center gap-1 text-status-valid-fg">
            <Icon name="verified" size={16} data-slot="icon" />
            <span className="text-label-sm font-medium">{row.signedBy.name}</span>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <AppShell
      navItems={getControlledNavItems('controlled-substances')}
      sidebar={{
        brand: {
          title: 'انبار دارو',
          subtitle: 'سامانه جامع موجودی داروخانه',
        },
      }}
      header={{
        branchLabel: 'داروخانه دکتر حسینی (مرکزی)',
        searchPlaceholder: 'جستجوی سریع دارو، سری ساخت یا کد رهگیری…',
        onSearchChange: setSearchInput,
        actions: (
          <>
            <Button
              type="button"
              variant="secondary"
              className="hidden sm:inline-flex"
              onClick={() => router.push('/dispensing-dispatch')}
            >
              <Icon name="prescriptions" size={18} data-slot="icon" />
              حواله نسخه
            </Button>
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              data-testid="header-register-controlled"
            >
              <Icon name="verified_user" size={18} data-slot="icon" />
              ثبت گردش مخدر
            </Button>
          </>
        ),
      }}
      contentClassName="space-y-space-lg"
    >
      {/* Top Operational Banner & Regulatory Meta */}
      <section className="relative overflow-hidden rounded-xl border border-border-default bg-surface p-space-lg">
        <div
          className="absolute inset-y-0 right-0 w-1.5 bg-status-critical-fg"
          aria-hidden
        />
        <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
          <div className="space-y-2 pr-2">
            <div className="flex flex-wrap items-center gap-2 text-label-sm">
              <Badge variant="critical" className="gap-1">
                <Icon name="shield" size={14} data-slot="icon" />
                سطح نظارتی ۱ (بسیار محرمانه و تحت کنترل)
              </Badge>
              <span className="tabular-nums-data text-text-secondary">
                شناسه دفترچه سپاس: ۹۸۲۴/م‌خ/۱۴۰۳
              </span>
              <span className="text-border-strong">•</span>
              <span className="tabular-nums-data text-text-secondary">
                پروانه تاسیس داروخانه: ۴۰۱/۱۲۷۶۵-الف
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-headline-lg font-bold text-text-primary">
                دفترچه رسمی گردش فرآورده‌های تحت کنترل و مخدر
              </h1>
              <Badge variant="secondary">نسخه دیجیتال استعلام لحظه‌ای TTAC</Badge>
            </div>

            <p className="max-w-4xl text-body-md text-text-secondary">
              مطابق ماده ۱۲ قانون مبارزه با مواد مخدر و ضوابط ابلاغی سازمان غذا و
              دارو، هرگونه جابه‌جایی، تحویل و ورود به گاوصندوق مرکزی مستلزم تطبیق
              دوگانه امضای مسئول فنی و شناسه یکتای TTAC می‌باشد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => exportControlledLedgerPdf(entries, kpis)}
              disabled={entries.length === 0}
              data-testid="ctrl-export-pdf"
            >
              <Icon
                name="picture_as_pdf"
                size={18}
                className="text-status-critical-fg"
                data-slot="icon"
              />
              استخراج گزارش بازرسی معاونت (PDF)
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={() => void handleExportFile('csv')}
              data-testid="ctrl-export-csv"
            >
              <Icon name="download" size={18} data-slot="icon" />
              خروجی CSV
            </Button>
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              data-testid="ctrl-open-register"
            >
              <Icon name="verified_user" size={18} data-slot="icon" />
              ثبت گردش جدید (حواله سهمیه / نسخه)
            </Button>
          </div>
        </div>
      </section>

      {/* KPI Metrics Grid */}
      <section
        aria-label="شاخص‌های امنیتی گاوصندوق"
        className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-4"
      >
        <KpiMetricCard
          title="موجودی فیزیکی گاوصندوق مرکزی"
          value={
            <span>
              {formatPersianNumber(kpis.totalVaultBalance)}{' '}
              <span className="text-label-md font-normal text-text-secondary">
                واحد (آمپول/قرص)
              </span>
            </span>
          }
          icon="lock_clock"
          tone="primary"
          delta={{
            label: `${formatPersianNumber(kpis.controlledDrugCount)} رده دارویی ثبت‌شده · تطابق پلمب`,
            direction: 'flat',
          }}
        />
        <KpiMetricCard
          title="ورودی ۳۰ روز اخیر (سهمیه پخش)"
          value={
            <span className="text-status-valid-fg">
              +{formatPersianNumber(kpis.monthInflow)}{' '}
              <span className="text-label-md font-normal text-text-secondary">
                عدد تحویلی
              </span>
            </span>
          }
          icon="inventory_2"
          tone="valid"
          delta={{
            label: `${formatPersianNumber(kpis.monthInflowShipments)} محموله بارنامه · ۱۰۰٪ تایید TTAC`,
            direction: 'up',
          }}
        />
        <KpiMetricCard
          title="خروجی تاییدشده با نسخه الکترونیک"
          value={
            <span className="text-status-critical-fg">
              -{formatPersianNumber(kpis.monthOutflow)}{' '}
              <span className="text-label-md font-normal text-text-secondary">
                واحد تحویل بیمار
              </span>
            </span>
          }
          icon="prescriptions"
          tone="critical"
          delta={{
            label: `${formatPersianNumber(kpis.activePrescriptionCount)} نسخه · پوکه امحاشده: ${formatPersianNumber(kpis.wasteDestroyedCount)}`,
            direction: 'down',
          }}
        />
        <KpiMetricCard
          title="تطبیق فیزیکی و ممیزی بازرس"
          value={`${toPersianDigits(kpis.reconciliationPct)}٪`}
          icon="verified"
          tone="info"
          delta={{
            label: kpis.lastAuditAt
              ? `آخرین ثبت: ${formatJalaliDate(kpis.lastAuditAt)}`
              : 'تایید مسئول فنی',
            direction: 'flat',
          }}
        />
      </section>

      {/* Main Split Workspace */}
      <section className="grid grid-cols-1 items-start gap-space-lg xl:grid-cols-12">
        <div className="space-y-space-md xl:col-span-9">
          {/* Filter Bar */}
          <Card className="p-4">
            <CardContent className="space-y-3 p-0">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="filter-ctrl-drug">فرآورده دارویی تحت کنترل</Label>
                  <Select
                    value={drugFilter}
                    onValueChange={(value) => {
                      setDrugFilter(value)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger id="filter-ctrl-drug" data-testid="ctrl-filter-drug">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        تمامی فرآورده‌های تحت نظارت ({formatPersianNumber(vaultItems.length)} قلم)
                      </SelectItem>
                      {vaultItems.map((item) => (
                        <SelectItem key={item.drugId} value={item.drugId}>
                          {item.nameFa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="filter-ctrl-tx">نوع گردش کار</Label>
                  <Select
                    value={txTypeFilter}
                    onValueChange={(value) => {
                      setTxTypeFilter(value as 'all' | ControlledTxType)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger id="filter-ctrl-tx" data-testid="ctrl-filter-tx">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه تراکنش‌ها</SelectItem>
                      <SelectItem value="in_distributor">
                        {TX_TYPE_LABELS.in_distributor}
                      </SelectItem>
                      <SelectItem value="out_prescription">
                        {TX_TYPE_LABELS.out_prescription}
                      </SelectItem>
                      <SelectItem value="waste_return">
                        {TX_TYPE_LABELS.waste_return}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="filter-ctrl-date">بازه زمانی ثبت</Label>
                  <Select
                    value={dateFilter}
                    onValueChange={(value) => {
                      setDateFilter(value as DateFilter)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger id="filter-ctrl-date" data-testid="ctrl-filter-date">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DATE_LABELS) as DateFilter[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {DATE_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="filter-ctrl-search">
                    جستجوی کدملی، کد رهگیری یا پزشک
                  </Label>
                  <div className="relative">
                    <Icon
                      name="search"
                      size={18}
                      className="pointer-events-none absolute right-2.5 top-2.5 text-text-secondary"
                      data-slot="icon"
                    />
                    <Input
                      id="filter-ctrl-search"
                      data-testid="ctrl-filter-search"
                      className="pr-9"
                      placeholder="مثال: صابری، MR-09 یا TTAC…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-label-sm">
                <span className="text-text-secondary">فیلترهای فعال:</span>
                {activeChips.length === 0 ? (
                  <span className="text-text-secondary">بدون فیلتر</span>
                ) : (
                  <>
                    {activeChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={chip.clear}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-text-primary hover:bg-surface-subtle"
                      >
                        <span>{chip.label}</span>
                        <Icon name="close" size={14} data-slot="icon" />
                      </button>
                    ))}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="ms-auto h-auto p-0"
                      onClick={handleClearFilters}
                    >
                      پاکسازی همه فیلترها
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ledger Table Container */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-surface-muted px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon
                  name="menu_book"
                  size={20}
                  className="text-primary"
                  data-slot="icon"
                />
                <h2 className="text-title-md font-bold text-text-primary">
                  ردیف‌های ثبتی دفترچه رسمی وزارت متبوع
                </h2>
                <Badge variant="info" className="tabular-nums-data">
                  {formatPersianNumber(total)} ردیف ثبت‌شده
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-label-sm text-text-secondary">
                <span className="size-2 rounded-full bg-status-valid-fg" aria-hidden />
                <span>دفترچه پلمب دیجیتال · فقط‌خواندنی (WORM)</span>
              </div>
            </div>

            {loadState === 'loading' ? (
              <div
                className="space-y-3 p-6"
                data-slot="controlled-ledger-skeleton"
                aria-busy="true"
              >
                <div className="h-8 w-full animate-pulse rounded bg-surface-muted" />
                <div className="h-12 w-full animate-pulse rounded bg-surface-muted" />
                <div className="h-12 w-full animate-pulse rounded bg-surface-muted" />
                <div className="h-12 w-full animate-pulse rounded bg-surface-muted" />
              </div>
            ) : loadState === 'error' ? (
              <div className="p-6">
                <AlertBanner
                  tone="critical"
                  title="خطا در دریافت دفترچه داروهای تحت کنترل"
                  description={errorMessage}
                  action={
                    <Button type="button" size="sm" onClick={() => void loadLedger()}>
                      تلاش مجدد
                    </Button>
                  }
                />
              </div>
            ) : entries.length === 0 ? (
              <div className="space-y-3 p-8 text-center">
                <p className="text-title-sm font-semibold text-text-primary">
                  ردیفی با این فیلترها در دفترچه یافت نشد
                </p>
                <p className="text-body-sm text-text-secondary">
                  فیلترهای جستجو را تغییر دهید یا یک گردش جدید ثبت کنید.
                </p>
                {activeChips.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    پاکسازی فیلترها
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                <DenseDataTable
                  columns={columns}
                  data={entries}
                  getRowId={(row) => row.id}
                  className="rounded-none border-0"
                  maxHeight="min(34rem, 62vh)"
                  caption="ردیف‌های ثبتی دفترچه رسمی فرآورده‌های تحت کنترل و مخدر"
                />
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  totalItems={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size)
                    setPage(1)
                  }}
                />
              </>
            )}
          </Card>
        </div>

        <div className="xl:col-span-3">
          <ControlledRegulatoryPanel
            vaultItems={vaultItems}
            selectedDrugId={drugFilter}
            onSelectDrug={(id) => {
              setDrugFilter(id)
              setPage(1)
            }}
            operatorName={operatorName}
            operatorRoleLabel={operatorRoleLabel}
          />
        </div>
      </section>

      <ControlledRegisterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vaultItems={vaultItems}
        vaultBins={vaultBins}
        initialDrugId={drugFilter === 'all' ? undefined : drugFilter}
        onSubmit={handleRegister}
      />
    </AppShell>
  )
}
