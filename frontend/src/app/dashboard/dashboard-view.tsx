'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Icon,
} from '@/components/ui'
import { AppShell } from '@/components/layout'
import { KardexTimeline } from '@/components/domain'
import {
  ActionTooltip,
  ConfirmDialog,
  DenseDataTable,
  KpiMetricCard,
  TriageStatusBadge,
  type DenseColumn,
  type TriageStatus,
} from '@/components/shared'
import { fetchDashboardSnapshot } from '@/lib/dashboard/data-access'
import type { DashboardLowStockRow, DashboardSnapshot, FefoTierId } from '@/lib/dashboard/types'
import { remainingDaysLabel } from '@/lib/expiry/expiry-query'
import {
  formatJalaliDate,
  formatPersianNumber,
  formatRial,
  toPersianDigits,
} from '@/lib/persian'
import { cn } from '@/lib/utils'
import { getDashboardNavItems } from './nav'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const TIER_DOT: Record<FefoTierId, string> = {
  ok: 'bg-status-valid-fg',
  watch: 'bg-secondary',
  warning: 'bg-primary',
  critical_expired: 'bg-status-critical-fg',
}

const TIER_COUNT_TONE: Record<FefoTierId, string> = {
  ok: 'text-status-valid-fg',
  watch: 'text-secondary',
  warning: 'text-primary',
  critical_expired: 'text-status-critical-fg',
}

const URGENCY_TRIAGE: Record<DashboardLowStockRow['urgency'], TriageStatus> = {
  critical: 'critical',
  low: 'expiring',
  reorder: 'warning',
  ok: 'valid',
}

function daysLabelFa(days: number | null): string {
  if (days === null) return '—'
  return toPersianDigits(remainingDaysLabel(days))
}

export function DashboardView() {
  const router = useRouter()
  const [loadState, setLoadState] = React.useState<LoadState>('loading')
  const [snapshot, setSnapshot] = React.useState<DashboardSnapshot | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [confirmBatchId, setConfirmBatchId] = React.useState<string | null>(
    null,
  )
  const disposeTriggerRef = React.useRef<HTMLButtonElement | null>(null)

  const load = React.useCallback(async (fail = false) => {
    setLoadState('loading')
    try {
      const data = await fetchDashboardSnapshot({ fail })
      const empty =
        data.kpis.activeDrugCount === 0 &&
        data.kpis.activeBatchCount === 0 &&
        data.lowStock.total === 0
      setSnapshot(data)
      setLoadState(empty ? 'empty' : 'ready')
    } catch {
      setSnapshot(null)
      setLoadState('error')
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      await load()
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const openBulkDispose = () => {
    setConfirmBatchId(null)
    setConfirmOpen(true)
  }

  const openQuarantine = (batchId: string) => {
    setConfirmBatchId(batchId)
    setConfirmOpen(true)
  }

  const onConfirmAction = () => {
    setConfirmOpen(false)
    if (confirmBatchId) {
      toast.success('سری ساخت به قرنطینه علامت‌گذاری شد (شبیه‌سازی محلی).')
    } else {
      toast.success('انتقال دسته‌جمعی به انبار امحا شبیه‌سازی شد.')
    }
    setConfirmBatchId(null)
    queueMicrotask(() => disposeTriggerRef.current?.focus())
  }

  const lowStockColumns = React.useMemo<DenseColumn<DashboardLowStockRow>[]>(
    () => [
      {
        id: 'rowNo',
        header: 'ردیف',
        cell: (row) => (
          <span className="tabular-nums-data text-text-secondary">
            {toPersianDigits(String(row.rowNo).padStart(2, '0'))}
          </span>
        ),
      },
      {
        id: 'name',
        header: 'نام دارو و شکل دارویی',
        cell: (row) => (
          <div>
            <div className="font-semibold text-text-primary">{row.nameFa}</div>
            <div className="text-label-sm text-text-secondary">{row.formHint}</div>
          </div>
        ),
      },
      {
        id: 'irc',
        header: 'کد ژنریک / IRC',
        dir: 'ltr',
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        cell: (row) => (
          <span className="font-latin tabular-nums-data text-label-sm text-text-secondary">
            {row.irc}
          </span>
        ),
      },
      {
        id: 'stock',
        header: 'موجودی فعلی',
        align: 'end',
        cell: (row) => (
          <span
            className={cn(
              'tabular-nums-data font-semibold',
              row.availableStock <= Math.max(1, row.reorderPoint * 0.4)
                ? 'text-status-critical-fg'
                : 'text-text-primary',
            )}
          >
            {formatPersianNumber(row.availableStock)} {row.unitLabel}
          </span>
        ),
      },
      {
        id: 'rop',
        header: 'نقطه سفارش',
        align: 'end',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <span className="tabular-nums-data text-text-secondary">
            {formatPersianNumber(row.reorderPoint)}
          </span>
        ),
      },
      {
        id: 'deficit',
        header: 'کسری موردنیاز',
        align: 'end',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        cell: (row) => (
          <span className="tabular-nums-data font-semibold text-primary">
            {formatPersianNumber(row.deficit)}+
          </span>
        ),
      },
      {
        id: 'status',
        header: 'وضعیت تأمین',
        cell: (row) => (
          <TriageStatusBadge status={URGENCY_TRIAGE[row.urgency]}>
            {row.urgencyLabel}
          </TriageStatusBadge>
        ),
      },
      {
        id: 'distributor',
        header: 'شرکت پخش پیش‌فرض',
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        cell: (row) => (
          <span className="text-text-secondary">{row.distributorNameFa}</span>
        ),
      },
      {
        id: 'actions',
        header: 'عملیات خرید',
        align: 'end',
        cell: (row) => (
          <ActionTooltip title="تکمیل و ثبت سفارش">
            <Button
              type="button"
              size="sm"
              variant={row.status === 'order_drafted' ? 'secondary' : 'default'}
              onClick={(event) => {
                event.stopPropagation()
                router.push('/auto-reorder-suggestions')
              }}
            >
              {row.ctaLabel}
            </Button>
          </ActionTooltip>
        ),
      },
    ],
    [router],
  )

  const shell = (
    <AppShell
      navItems={getDashboardNavItems('dashboard')}
      sidebar={{
        brand: {
          title: 'فارما استاک',
          subtitle: 'مدیریت بالینی انبار',
        },
      }}
      header={{
        branchLabel: 'داروخانه دکتر حسینی (مرکزی)',
        searchPlaceholder: 'جستجو بر اساس IRC ،UID یا نام دارو...',
        actions: (
          <Button
            type="button"
            className="hidden sm:inline-flex"
            onClick={() => router.push('/drug-catalog')}
          >
            <Icon name="add_circle" size={18} data-slot="icon" />
            ثبت داروی جدید
          </Button>
        ),
      }}
      contentClassName="space-y-space-lg"
    >
      {loadState === 'loading' ? (
        <DashboardSkeleton />
      ) : loadState === 'error' ? (
        <Card className="p-space-lg">
          <CardHeader className="p-0">
            <CardTitle>خطا در بارگذاری میز کار</CardTitle>
            <CardDescription>
              دریافت خلاصه عملیاتی ناموفق بود. دوباره تلاش کنید.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-4 p-0">
            <Button type="button" onClick={() => void load()}>
              تلاش مجدد
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ms-2"
              onClick={() => void load(true)}
            >
              شبیه‌سازی خطا
            </Button>
          </CardFooter>
        </Card>
      ) : loadState === 'empty' || !snapshot ? (
        <Card className="p-space-lg text-center">
          <CardTitle>داده‌ای برای نمایش وجود ندارد</CardTitle>
          <CardDescription className="mt-2">
            هنوز قلم فعال، سری ساخت یا کسری ثبت نشده است.
          </CardDescription>
          <Button type="button" className="mt-4" onClick={() => void load()}>
            تازه‌سازی
          </Button>
        </Card>
      ) : (
        <>
          {/* Hero / operational banner */}
          <section className="flex flex-col justify-between gap-space-lg rounded-xl border border-border-default bg-surface p-space-lg xl:flex-row xl:items-center">
            <div className="flex items-center gap-space-md">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
                <Icon name="monitor_heart" size={32} data-slot="icon" />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-space-xs">
                  <span
                    className="size-2.5 animate-pulse rounded-full bg-status-valid-fg"
                    aria-hidden
                  />
                  <span className="text-label-sm font-bold text-status-valid-fg">
                    پایگاه داده زنده انبار مرکزی
                  </span>
                  <span className="text-text-muted">/</span>
                  <span className="tabular-nums-data text-label-sm text-text-secondary">
                    {snapshot.healthVersionLabel}
                  </span>
                </div>
                <h1 className="text-headline-lg font-extrabold leading-tight text-text-primary">
                  میز کار پایش و انبارداری دارویی
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-space-sm text-body-sm text-text-secondary">
                  <Icon
                    name="calendar_today"
                    size={16}
                    className="text-primary"
                    data-slot="icon"
                  />
                  <span className="tabular-nums-data font-medium">
                    {snapshot.todayJalaliLabel}
                  </span>
                  <span className="text-border-strong">•</span>
                  <span className="tabular-nums-data">{snapshot.shiftLabel}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <Button
                type="button"
                onClick={() => router.push('/dispensing-dispatch')}
              >
                <Icon name="prescriptions" size={20} data-slot="icon" />
                نسخه‌پیچی (POS)
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/invoice-receipts')}
              >
                <Icon name="post_add" size={20} data-slot="icon" />
                ثبت فاکتور خرید
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/periodic-stocktake')}
              >
                <Icon name="rule" size={20} data-slot="icon" />
                انبارگردانی فوری
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => toast.success('خروجی اکسل روزانه شبیه‌سازی شد.')}
              >
                <Icon
                  name="file_download"
                  size={20}
                  className="text-status-valid-fg"
                  data-slot="icon"
                />
                خروجی اکسل روزانه
              </Button>
            </div>
          </section>

          {/* KPI row */}
          <section
            aria-label="شاخص‌های کلیدی انبار"
            className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            <button
              type="button"
              className="ps-focus-ring rounded-xl text-start"
              onClick={() => router.push('/drug-catalog')}
            >
              <KpiMetricCard
                title="کل اقلام دارویی فعال"
                value={formatPersianNumber(snapshot.kpis.activeDrugCount)}
                description="قلم ژنریک"
                icon="medication"
                tone="primary"
                delta={{
                  label: snapshot.kpis.activeDrugDeltaLabel,
                  direction: 'up',
                }}
              />
            </button>
            <button
              type="button"
              className="ps-focus-ring rounded-xl text-start"
              onClick={() => router.push('/shelf-inventory')}
            >
              <KpiMetricCard
                title="سری‌های ساخت (بَچ)"
                value={formatPersianNumber(snapshot.kpis.activeBatchCount)}
                description="بَچ فعال در انبار"
                icon="layers"
                tone="info"
                delta={{
                  label: snapshot.kpis.batchDistributionLabel,
                  direction: 'flat',
                }}
              />
            </button>
            <button
              type="button"
              className="ps-focus-ring rounded-xl text-start"
              onClick={() =>
                router.push('/expiry-alerts-fefo?bucket=warning')
              }
            >
              <KpiMetricCard
                title="نزدیک به انقضا (<۹۰ روز)"
                value={
                  <span className="text-status-critical-fg">
                    {formatPersianNumber(snapshot.kpis.nearExpiryCount)}
                  </span>
                }
                description="قلم پرریسک"
                icon="history_toggle_off"
                tone="expiring"
                delta={{
                  label: `ارزش: ${formatRial(snapshot.kpis.nearExpiryValueRial)}`,
                  direction: 'flat',
                }}
              />
            </button>
            <button
              type="button"
              className="ps-focus-ring rounded-xl text-start"
              onClick={() =>
                router.push('/expiry-alerts-fefo?bucket=expired')
              }
            >
              <KpiMetricCard
                title="منقضی‌شده (قرنطینه)"
                value={
                  <span className="text-status-critical-fg">
                    {formatPersianNumber(snapshot.kpis.expiredCount)}
                  </span>
                }
                description="ردیف مسدود"
                icon="dangerous"
                tone="critical"
                delta={{
                  label: 'اقدام فوری امحا / برگشت',
                  direction: 'flat',
                }}
              />
            </button>
            <button
              type="button"
              className="ps-focus-ring rounded-xl text-start"
              onClick={() => router.push('/auto-reorder-suggestions')}
            >
              <KpiMetricCard
                title="کسری و زیر نقطه سفارش"
                value={formatPersianNumber(snapshot.kpis.belowRopCount)}
                description="قلم بحرانی"
                icon="production_quantity_limits"
                tone="primary"
                delta={{
                  label: snapshot.kpis.pendingOrdersLabel,
                  direction: 'flat',
                }}
              />
            </button>
          </section>

          {/* FEFO matrix */}
          <section className="flex flex-col gap-space-md" aria-labelledby="fefo-heading">
            <div className="flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
              <div className="flex items-center gap-space-sm">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon name="access_time_filled" size={18} data-slot="icon" />
                </div>
                <div>
                  <h2
                    id="fefo-heading"
                    className="text-headline-sm font-bold text-text-primary"
                  >
                    پایش چندمرحله‌ای انقضا و مدیریت ورود-خروج داروها (FEFO
                    Matrix)
                  </h2>
                  <p className="text-body-sm text-text-secondary">
                    سیاست خروج اجباری بر اساس اولویت پایان تاریخ مصرف و تفکیک
                    رنگی مناطق انبار
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-space-xs rounded-lg bg-surface-muted px-space-md py-1.5 text-label-md text-text-secondary">
                <Icon
                  name="verified_user"
                  size={16}
                  className="text-status-valid-fg"
                  data-slot="icon"
                />
                <span>سامانه تطبیق IRC با سامانه تیتک (TTAC)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-4">
              {snapshot.fefoTiers.map((tier) => (
                <Card
                  key={tier.id}
                  className="flex flex-col justify-between gap-0 p-space-md"
                  data-tier={tier.id}
                >
                  <CardHeader className="gap-space-sm p-0">
                    <div className="flex items-center justify-between gap-2 pb-space-sm">
                      <div className="flex items-center gap-space-xs">
                        <span
                          className={cn('size-3 rounded-full', TIER_DOT[tier.id])}
                          aria-hidden
                        />
                        <CardTitle
                          className={cn(
                            'text-title-md font-bold',
                            tier.id === 'critical_expired'
                              ? 'text-status-critical-fg'
                              : 'text-text-primary',
                          )}
                        >
                          {tier.title}
                        </CardTitle>
                      </div>
                      <Badge variant="secondary">{tier.badge}</Badge>
                    </div>
                    <div className="my-space-sm flex items-baseline gap-1">
                      <span
                        className={cn(
                          'text-headline-lg font-bold tabular-nums-data',
                          TIER_COUNT_TONE[tier.id],
                        )}
                      >
                        {formatPersianNumber(tier.count)}
                      </span>
                      <span className="text-label-sm text-text-secondary">
                        {tier.countNote ?? 'ردیف'}
                      </span>
                    </div>
                    <CardDescription className="mb-space-sm text-body-sm">
                      {tier.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-space-xs p-0">
                    {tier.samples.length === 0 ? (
                      <p className="rounded-lg bg-surface-muted p-2 text-label-sm text-text-secondary">
                        موردی در این بازه نیست.
                      </p>
                    ) : (
                      tier.samples.map((sample) => (
                        <div
                          key={sample.batchId}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-lg p-2',
                            tier.id === 'critical_expired'
                              ? 'bg-status-critical-bg/40'
                              : 'bg-surface-muted',
                          )}
                        >
                          <div className="min-w-0">
                            <span className="block text-label-md font-semibold text-text-primary">
                              {sample.nameFa}
                            </span>
                            <span className="block font-latin tabular-nums-data text-label-sm text-text-secondary">
                              بَچ: {sample.batchNo} | انقضا:{' '}
                              {formatJalaliDate(sample.expiryISO)}
                            </span>
                          </div>
                          {tier.showQuarantineAction &&
                          sample.bucket === 'expired' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => openQuarantine(sample.batchId)}
                            >
                              قرنطینه
                            </Button>
                          ) : (
                            <span
                              className={cn(
                                'shrink-0 text-label-sm font-bold tabular-nums-data',
                                TIER_COUNT_TONE[tier.id],
                              )}
                            >
                              {daysLabelFa(sample.daysRemaining)}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                  <CardFooter className="mt-space-md flex items-center justify-between gap-2 border-t border-border-subtle p-0 pt-space-md text-label-sm">
                    {tier.showBulkDisposal ? (
                      <Button
                        ref={disposeTriggerRef}
                        type="button"
                        variant="destructive"
                        className="w-full"
                        onClick={openBulkDispose}
                      >
                        <Icon name="lock_reset" size={16} data-slot="icon" />
                        انتقال دسته جمعی به انبار امحا
                      </Button>
                    ) : tier.showPromoteAction ? (
                      <>
                        <button
                          type="button"
                          className="ps-focus-ring inline-flex items-center gap-1 font-bold text-secondary hover:underline"
                          onClick={() =>
                            router.push('/expiry-alerts-fefo?bucket=watch')
                          }
                        >
                          ارسال به ویترین فعال
                          <Icon name="arrow_back" size={14} data-slot="icon" />
                        </button>
                        <span className="tabular-nums-data text-text-secondary">
                          {tier.footerEmphasis}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-text-secondary">
                          {tier.footerLabel}
                        </span>
                        <span
                          className={cn(
                            'font-medium',
                            tier.id === 'warning'
                              ? 'text-primary'
                              : 'text-status-valid-fg',
                          )}
                        >
                          {tier.footerEmphasis}
                        </span>
                      </>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>

          {/* Low stock + activity */}
          <section className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
            <Card className="flex flex-col justify-between gap-0 p-space-md xl:col-span-8">
              <div>
                <div className="flex flex-col justify-between gap-space-sm pb-space-md sm:flex-row sm:items-center">
                  <div className="flex items-center gap-space-sm">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-surface-muted text-primary">
                      <Icon name="emergency" size={18} data-slot="icon" />
                    </div>
                    <div>
                      <h3 className="text-title-md font-bold text-text-primary">
                        جدول اقلام کسری و زیر نقطه سفارش مجدد (ROP)
                      </h3>
                      <p className="text-body-sm text-text-secondary">
                        فهرست داروهای راهبردی جهت ثبت سفارش خرید فوری به
                        شرکت‌های پخش دارویی
                      </p>
                    </div>
                  </div>
                  <Badge variant="critical" className="tabular-nums-data">
                    {formatPersianNumber(snapshot.lowStock.total)} ردیف نیازمند
                    شارژ
                  </Badge>
                </div>
                <DenseDataTable
                  columns={lowStockColumns}
                  data={snapshot.lowStock.rows}
                  getRowId={(row) => row.id}
                  maxHeight="min(24rem, 50vh)"
                  emptyMessage="کسری فعالی ثبت نشده است."
                  caption="پیش‌نمایش اقلام زیر نقطه سفارش"
                />
              </div>
              <div className="flex flex-col justify-between gap-space-sm pt-space-md sm:flex-row sm:items-center">
                <span className="text-label-sm text-text-secondary">
                  نمایش {formatPersianNumber(snapshot.lowStock.rows.length)} قلم
                  از کل {formatPersianNumber(snapshot.lowStock.total)} قلم کسری
                  بحرانی
                </span>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 font-bold text-primary"
                  onClick={() => router.push('/auto-reorder-suggestions')}
                >
                  مشاهده و سفارش‌گذاری انبوه تمام{' '}
                  {formatPersianNumber(snapshot.lowStock.total)} قلم کسری
                  <Icon name="west" size={18} data-slot="icon" />
                </Button>
              </div>
            </Card>

            <Card className="flex flex-col justify-between gap-0 p-space-md xl:col-span-4">
              <div>
                <div className="flex items-center justify-between pb-space-md">
                  <h3 className="text-title-md font-bold text-text-primary">
                    خوراک رویدادهای زنده انبار
                  </h3>
                  <span
                    className="size-2 rounded-full bg-status-valid-fg"
                    aria-hidden
                  />
                </div>
                <KardexTimeline
                  items={snapshot.activity.map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    timestamp: item.timestamp,
                    meta: item.meta,
                    tone: item.tone,
                  }))}
                  emptyLabel="رویداد زنده‌ای ثبت نشده است."
                />
              </div>
              <div className="pt-space-md">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push('/audit-log')}
                >
                  مشاهده تاریخچه کامل لاگ‌ها (Audit Trail)
                  <Icon name="history" size={16} data-slot="icon" />
                </Button>
              </div>
            </Card>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) {
            queueMicrotask(() => disposeTriggerRef.current?.focus())
          }
        }}
        tone="critical"
        title={
          confirmBatchId
            ? 'تأیید انتقال به قرنطینه'
            : 'تأیید انتقال دسته‌جمعی به انبار امحا'
        }
        description={
          confirmBatchId
            ? 'این سری ساخت منقضی از گردش نسخ خارج و به باکس قرنطینه منتقل می‌شود. تغییر فقط در وضعیت محلی صفحه است و با بارگذاری مجدد بازنشانی می‌شود.'
            : 'تمام ردیف‌های بحرانی/منقضی این ماتریس FEFO برای امحا علامت‌گذاری می‌شوند (شبیه‌سازی محلی؛ بدون ثبت دائمی).'
        }
        confirmLabel="تأیید اقدام"
        cancelLabel="انصراف"
        onConfirm={onConfirmAction}
      />
    </AppShell>
  )

  return shell
}

function DashboardSkeleton() {
  return (
    <div className="space-y-space-lg" aria-busy="true" aria-live="polite">
      <div className="h-28 animate-pulse rounded-xl bg-surface-muted" />
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl bg-surface-muted"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-xl bg-surface-muted"
          />
        ))}
      </div>
      <p className="text-center text-body-sm text-text-secondary">
        در حال آماده‌سازی میز کار…
      </p>
    </div>
  )
}
