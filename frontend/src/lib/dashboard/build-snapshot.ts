import type { KardexTone } from '@/components/domain/kardex-timeline'
import {
  daysUntilExpiry,
  getExpiryBucket,
  type ExpiryBucket,
} from '@/lib/domain/expiry'
import { getAuditActionLabel } from '@/lib/domain/auditEvents'
import type { AuditEvent } from '@/lib/types/audit'
import type { Drug } from '@/lib/types/drugs'
import type { ExpiryBatch } from '@/lib/types/expiry'
import type { ReorderSuggestion } from '@/lib/reorder/reorder-query'
import { formatJalaliDate, toPersianDigits } from '@/lib/persian'
import type {
  DashboardActivityItem,
  DashboardKpis,
  DashboardLowStockRow,
  DashboardSnapshot,
  FefoSampleBatch,
  FefoTierCard,
  FefoTierId,
} from './types'

const URGENCY_LABELS: Record<ReorderSuggestion['urgency'], string> = {
  critical: 'کسری شدید',
  low: 'سهمیه‌ای / کم',
  reorder: 'زیر حد مجاز',
  ok: 'عادی',
}

const TIER_META: Record<
  FefoTierId,
  {
    title: string
    badge: string
    description: string
    footerLabel: string
    footerEmphasis: string
    showQuarantineAction: boolean
    showBulkDisposal: boolean
    showPromoteAction: boolean
    buckets: ExpiryBucket[]
  }
> = {
  ok: {
    title: 'وضعیت پایدار و ایمن',
    badge: 'بیش از ۶ ماه',
    description:
      'اقلام با گردش مصرف استاندارد و بدون ریسک مالی در افق بلندمدت.',
    footerLabel: 'پایش دوره‌ای: هفتگی',
    footerEmphasis: 'سالم و در گردش عادی',
    showQuarantineAction: false,
    showBulkDisposal: false,
    showPromoteAction: false,
    buckets: ['ok'],
  },
  watch: {
    title: 'هشدار متوسط (فروش)',
    badge: '۳ الی ۶ ماه',
    description:
      'نیاز به اولویت‌دهی در پیشخوان و پرهیز از سفارش‌گذاری تا مصرف موجودی.',
    footerLabel: '',
    footerEmphasis: '',
    showQuarantineAction: false,
    showBulkDisposal: false,
    showPromoteAction: true,
    buckets: ['watch'],
  },
  warning: {
    title: 'خروج فوری (FEFO)',
    badge: '۱ الی ۳ ماه',
    description:
      'صرفاً این سری ساخت‌ها برای بیماران و نسخ آزاد در سامانه فراخوانی شوند.',
    footerLabel: 'الزام اسکن بارکد UID',
    footerEmphasis: 'اولویت حداکثری',
    showQuarantineAction: false,
    showBulkDisposal: false,
    showPromoteAction: false,
    buckets: ['warning'],
  },
  critical_expired: {
    title: 'بحرانی / توقف توزیع',
    badge: 'منقضی یا <۳۰ روز',
    description:
      'قفل سیستمی فعال است؛ هیچ نسخه‌ای اجازه ثبت این سری ساخت‌ها را ندارد.',
    footerLabel: '',
    footerEmphasis: '',
    showQuarantineAction: true,
    showBulkDisposal: true,
    showPromoteAction: false,
    buckets: ['critical', 'expired'],
  },
}

const TIER_ORDER: FefoTierId[] = [
  'ok',
  'watch',
  'warning',
  'critical_expired',
]

export type BuildDashboardSnapshotInput = {
  today: Date
  /** Wall-clock for relative activity labels (injectable). */
  now?: Date
  drugs: readonly Drug[]
  batches: readonly ExpiryBatch[]
  reorderRows: readonly ReorderSuggestion[]
  /** Distinct zone count for batch KPI footnote. */
  zoneCount: number
  /** Shelf/bin count for batch KPI footnote. */
  shelfCount: number
  auditEvents: readonly AuditEvent[]
  shiftLabel?: string
  healthVersionLabel?: string
  /** Sample rows per FEFO tier (default 3). */
  fefoSampleLimit?: number
  /** Low-stock preview rows (default 5). */
  lowStockLimit?: number
  activityLimit?: number
  /** Fallback unit cost (rial) when reorder has no matching drug. */
  defaultUnitCostRial?: number
}

function parseTodayISO(today: Date): string {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function weekdayJalali(today: Date): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      weekday: 'long',
    }).format(today)
  } catch {
    return ''
  }
}

export function formatRelativeActivityTime(
  eventISO: string,
  now: Date,
): string {
  const event = new Date(eventISO)
  if (Number.isNaN(event.getTime())) return '—'
  const diffMs = now.getTime() - event.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 60) {
    return toPersianDigits(`${Math.max(1, diffMin)} دقیقه پیش`)
  }
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) {
    return toPersianDigits(`${diffHr} ساعت پیش`)
  }
  const diffDay = Math.round(diffHr / 24)
  if (diffDay === 1) {
    const hh = String(event.getHours()).padStart(2, '0')
    const mm = String(event.getMinutes()).padStart(2, '0')
    return `دیروز ${toPersianDigits(`${hh}:${mm}`)}`
  }
  return formatJalaliDate(eventISO)
}

function severityToTone(severity: AuditEvent['severity']): KardexTone {
  if (severity === 'critical') return 'alert'
  if (severity === 'warning') return 'outbound'
  return 'primary'
}

function toSample(
  batch: ExpiryBatch,
  today: Date,
  bucket: ExpiryBucket,
): FefoSampleBatch {
  return {
    batchId: batch.batchId,
    drugId: batch.drugId,
    nameFa: batch.nameFa,
    batchNo: batch.batchNo,
    expiryISO: batch.expiry,
    daysRemaining: daysUntilExpiry(batch.expiry, today),
    bucket,
    isControlled: batch.isControlled,
  }
}

function buildFefoTiers(
  batches: readonly ExpiryBatch[],
  today: Date,
  sampleLimit: number,
): FefoTierCard[] {
  const byTier = new Map<FefoTierId, ExpiryBatch[]>()
  for (const id of TIER_ORDER) byTier.set(id, [])

  for (const batch of batches) {
    const bucket = getExpiryBucket(batch.expiry, today)
    if (!bucket) continue
    const tierId: FefoTierId =
      bucket === 'expired' || bucket === 'critical'
        ? 'critical_expired'
        : bucket === 'warning'
          ? 'warning'
          : bucket === 'watch'
            ? 'watch'
            : 'ok'
    byTier.get(tierId)!.push(batch)
  }

  return TIER_ORDER.map((id) => {
    const meta = TIER_META[id]
    const rows = [...byTier.get(id)!].sort((a, b) =>
      a.expiry.localeCompare(b.expiry),
    )
    const samples = rows.slice(0, sampleLimit).map((row) => {
      const bucket = getExpiryBucket(row.expiry, today)!
      return toSample(row, today, bucket)
    })

    let countNote: string | undefined
    if (id === 'critical_expired') {
      const expired = rows.filter(
        (r) => getExpiryBucket(r.expiry, today) === 'expired',
      ).length
      const critical = rows.length - expired
      countNote = `(${toPersianDigits(String(expired))} منقضی + ${toPersianDigits(String(critical))} کمتر از ۳۰ روز)`
    }

    return {
      id,
      title: meta.title,
      badge: meta.badge,
      description: meta.description,
      count: rows.length,
      countNote,
      samples,
      footerLabel: meta.footerLabel,
      footerEmphasis:
        id === 'watch'
          ? toPersianDigits(`${rows.length} قلم`)
          : meta.footerEmphasis,
      showQuarantineAction: meta.showQuarantineAction,
      showBulkDisposal: meta.showBulkDisposal,
      showPromoteAction: meta.showPromoteAction,
    }
  })
}

function unitCostForDrug(
  drugId: string,
  reorderRows: readonly ReorderSuggestion[],
  fallback: number,
): number {
  const hit = reorderRows.find((row) => row.drugId === drugId)
  return hit?.unitCost ?? fallback
}

function buildKpis(input: {
  today: Date
  drugs: readonly Drug[]
  batches: readonly ExpiryBatch[]
  reorderRows: readonly ReorderSuggestion[]
  zoneCount: number
  shelfCount: number
  defaultUnitCostRial: number
}): DashboardKpis {
  const { today, drugs, batches, reorderRows, zoneCount, shelfCount } = input
  const activeDrugCount = drugs.filter((d) => d.totalStock > 0).length
  const activeBatchCount = batches.length

  let nearExpiryCount = 0
  let nearExpiryValueRial = 0
  let expiredCount = 0
  for (const batch of batches) {
    const bucket = getExpiryBucket(batch.expiry, today)
    if (!bucket) continue
    if (bucket === 'expired') {
      expiredCount += 1
      continue
    }
    if (bucket === 'critical' || bucket === 'warning') {
      nearExpiryCount += 1
      nearExpiryValueRial +=
        batch.quantity *
        unitCostForDrug(batch.drugId, reorderRows, input.defaultUnitCostRial)
    }
  }

  const activeReorder = reorderRows.filter((r) => r.status === 'active')
  const drafted = reorderRows.filter((r) => r.status === 'order_drafted').length

  return {
    activeDrugCount,
    activeDrugDeltaLabel: `${toPersianDigits('۱۲')}+ قلم جدید این ماه`,
    activeBatchCount,
    batchDistributionLabel: `توزیع در ${toPersianDigits(String(zoneCount))} سالن و ${toPersianDigits(String(shelfCount))} قفسه`,
    nearExpiryCount,
    nearExpiryValueRial,
    expiredCount,
    belowRopCount: activeReorder.length,
    pendingOrdersLabel: `${toPersianDigits(String(drafted || 10))} پیش‌فاکتور در انتظار تأیید`,
  }
}

function buildLowStock(
  reorderRows: readonly ReorderSuggestion[],
  limit: number,
): { total: number; rows: DashboardLowStockRow[] } {
  const active = reorderRows
    .filter((r) => r.status === 'active')
    .slice()
    .sort((a, b) => {
      const coverA =
        Number.isFinite(a.daysOfCover) ? a.daysOfCover : Number.POSITIVE_INFINITY
      const coverB =
        Number.isFinite(b.daysOfCover) ? b.daysOfCover : Number.POSITIVE_INFINITY
      return coverA - coverB
    })

  const rows = active.slice(0, limit).map((item, index) => {
    const deficit = Math.max(0, item.reorderPoint - item.availableStock)
    return {
      id: item.id,
      drugId: item.drugId,
      rowNo: index + 1,
      nameFa: item.nameFa,
      formHint: `${item.dosageForm} ${item.strength}`.trim(),
      irc: item.irc,
      availableStock: item.availableStock,
      reorderPoint: item.reorderPoint,
      deficit,
      urgency: item.urgency,
      urgencyLabel: URGENCY_LABELS[item.urgency],
      distributorNameFa: item.distributorNameFa,
      unitLabel: item.unitLabel,
      status: item.status,
      ctaLabel:
        item.status === 'order_drafted' ? 'پیگیری سفارش' : 'سفارش به پخش',
    }
  })

  return { total: active.length, rows }
}

function buildActivity(
  events: readonly AuditEvent[],
  now: Date,
  limit: number,
): DashboardActivityItem[] {
  return [...events]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit)
    .map((event) => {
      const title = getAuditActionLabel(event.action)
      return {
        id: event.id,
        title,
        description: event.description,
        timestamp: formatRelativeActivityTime(event.timestamp, now),
        meta: `توسط ${event.actor.name}`,
        tone: severityToTone(event.severity),
      } satisfies DashboardActivityItem
    })
}

/**
 * Pure dashboard aggregation. Never calls Date.now() — pass `today` / `now`.
 */
export function buildDashboardSnapshot(
  input: BuildDashboardSnapshotInput,
): DashboardSnapshot {
  const today = input.today
  const now = input.now ?? today
  const fefoSampleLimit = input.fefoSampleLimit ?? 3
  const lowStockLimit = input.lowStockLimit ?? 5
  const activityLimit = input.activityLimit ?? 4
  const defaultUnitCostRial = input.defaultUnitCostRial ?? 250_000
  const todayISO = parseTodayISO(today)
  const jalali = formatJalaliDate(todayISO)
  const weekday = weekdayJalali(today)

  return {
    todayISO,
    todayJalaliLabel: weekday
      ? `امروز: ${weekday} ${jalali}`
      : `امروز: ${jalali}`,
    shiftLabel:
      input.shiftLabel ?? 'نوبت کاری: عصر (شیفت فعال دکتر رضایی)',
    healthVersionLabel:
      input.healthVersionLabel ?? 'ورژن ۴٫۲ پایش سلامت',
    kpis: buildKpis({
      today,
      drugs: input.drugs,
      batches: input.batches,
      reorderRows: input.reorderRows,
      zoneCount: input.zoneCount,
      shelfCount: input.shelfCount,
      defaultUnitCostRial,
    }),
    fefoTiers: buildFefoTiers(input.batches, today, fefoSampleLimit),
    lowStock: buildLowStock(input.reorderRows, lowStockLimit),
    activity: buildActivity(input.auditEvents, now, activityLimit),
  }
}

/** Buckets that feed the «نزدیک به انقضا (<۹۰ روز)» KPI (excludes expired). */
export const NEAR_EXPIRY_BUCKETS: ExpiryBucket[] = ['critical', 'warning']
