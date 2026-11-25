import type { ExpiryBatchStatus } from '@/lib/types/expiry'

export type InventoryStatus = 'valid' | 'low' | 'expiring' | 'expired_quarantine'

export type InventorySortField = 'expiry' | 'nameFa' | 'quantity'

export type InventoryKpis = {
  totalSkus: number
  catalogTotalSkus: number
  activeCategories: number
  demandCoveragePct: number
  belowRopCount: number
  criticalShortageCount: number
  avgLeadTimeDays: number
  nearExpiryCount: number
  criticalExpiryCount: number
  nearExpiryValueRial: number
  totalValuationRial: number
  totalUnits: number
  activeBatchCount: number
  lastAuditISO: string
}

export type InventoryRow = {
  batchId: string
  drugId: string
  nameFa: string
  brandName: string
  dosageForm: string
  strength: string
  genericCode: string
  gtin: string
  category: string
  isControlled: boolean
  storageTemp: 'room' | 'fridge' | 'freezer' | 'light' | string
  batchNo: string
  expiry: string
  daysUntilExpiry: number
  expiryBucket: 'expired' | 'critical' | 'warning' | 'watch' | 'ok'
  quantity: number
  drugUsableStock: number
  reorderLevel: number
  unitLabel: string
  binId: string
  locationLabel: string
  zone: string
  batchStatus: ExpiryBatchStatus
  inventoryStatus: InventoryStatus
  buyPriceRial: number
  consumerPriceRial: number
  rowValueRial: number
}

export type InventoryDashboardQuery = {
  search?: string
  category?: string
  stockStatus?: InventoryStatus | ''
  storageTemp?: string
  sortBy?: InventorySortField
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type InventoryDashboardResponse = {
  todayISO: string
  kpis: InventoryKpis
  items: InventoryRow[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type StockInInput = {
  drugId?: string
  nameFa?: string
  brandName?: string
  dosageForm?: string
  strength?: string
  gtin?: string
  genericCode?: string
  manufacturer?: string
  category?: string
  isControlled?: boolean
  atcCode?: string
  storageTemp?: 'room' | 'fridge' | 'freezer' | 'light'
  reorderLevel?: number
  batchNo: string
  expiry: string
  quantity: number
  unitLabel?: string
  binId?: string
  locationLabel?: string
  distributor?: string
  invoiceNo?: string
  storageNote?: string
  buyPriceRial?: number
  consumerPriceRial?: number
}

export type BulkStatusResult = {
  updatedCount: number
  status: ExpiryBatchStatus
}
