import type { DrugCategory } from '@/lib/types/drugs'
import type { ShelfZoneId } from '@/lib/types/shelves'

export type ExpiryBatchStatus =
  | 'active'
  | 'quarantined'
  | 'marked_return'
  | 'quick_sale'
  | 'relocated'

export type ExpiryBatch = {
  batchId: string
  drugId: string
  nameFa: string
  nameEn: string
  manufacturer: string
  distributor: string
  invoiceNo: string
  batchNo: string
  /** ISO calendar date YYYY-MM-DD */
  expiry: string
  quantity: number
  unitLabel: string
  locationLabel: string
  storageNote: string
  zone: ShelfZoneId
  category: DrugCategory
  isControlled: boolean
  status: ExpiryBatchStatus
  productionISO?: string
  buyPriceRial?: number
  consumerPriceRial?: number
}

export type ExpiryKpis = {
  expired: number
  critical: number
  warning: number
  watch: number
  ok: number
  allAlerts: number
  markedReturn: number
}

export type GetExpiryBatchesResult = {
  items: ExpiryBatch[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: ExpiryKpis
  allItems: ExpiryBatch[]
}
