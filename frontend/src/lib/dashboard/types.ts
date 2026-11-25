import type { KardexTone } from '@/components/domain/kardex-timeline'
import type { ExpiryBucket } from '@/lib/domain/expiry'
import type { ReorderUrgency } from '@/lib/domain/reorder'

/** FEFO matrix tier ids on the dashboard (maps onto expiry buckets). */
export type FefoTierId = 'ok' | 'watch' | 'warning' | 'critical_expired'

export type FefoSampleBatch = {
  batchId: string
  drugId: string
  nameFa: string
  batchNo: string
  expiryISO: string
  /** Days remaining (negative if expired); null if invalid. */
  daysRemaining: number | null
  bucket: ExpiryBucket
  isControlled: boolean
}

export type FefoTierCard = {
  id: FefoTierId
  title: string
  badge: string
  description: string
  count: number
  /** Extra Persian count footnote (e.g. expired+critical split). */
  countNote?: string
  samples: FefoSampleBatch[]
  footerLabel: string
  footerEmphasis: string
  showQuarantineAction: boolean
  showBulkDisposal: boolean
  showPromoteAction: boolean
}

export type DashboardKpis = {
  activeDrugCount: number
  activeDrugDeltaLabel: string
  activeBatchCount: number
  batchDistributionLabel: string
  nearExpiryCount: number
  nearExpiryValueRial: number
  expiredCount: number
  belowRopCount: number
  pendingOrdersLabel: string
}

export type DashboardLowStockRow = {
  id: string
  drugId: string
  rowNo: number
  nameFa: string
  formHint: string
  irc: string
  availableStock: number
  reorderPoint: number
  deficit: number
  urgency: ReorderUrgency
  urgencyLabel: string
  distributorNameFa: string
  unitLabel: string
  status: 'active' | 'order_drafted' | 'dismissed'
  ctaLabel: string
}

export type DashboardActivityItem = {
  id: string
  title: string
  description: string
  timestamp: string
  meta?: string
  tone: KardexTone
}

export type DashboardSnapshot = {
  todayISO: string
  todayJalaliLabel: string
  shiftLabel: string
  healthVersionLabel: string
  kpis: DashboardKpis
  fefoTiers: FefoTierCard[]
  lowStock: {
    total: number
    rows: DashboardLowStockRow[]
  }
  activity: DashboardActivityItem[]
}
