export type ReconciliationStatus = 'uploaded' | 'mapped' | 'confirmed' | 'cancelled'

export type ReconcileRowMatchStatus = 'matched' | 'new_item' | 'price_mismatch'

export type ColumnMapping = {
  nameFa: number
  gtin: number
  irc: number
  batchNo: number
  expiry: number
  quantity: number
  buyPriceRial: number
  consumerPriceRial: number
  unitLabel: number
}

export type ReconciledRow = {
  id: string
  rowNumber: number
  excelName: string
  gtin?: string
  irc?: string
  batchNo: string
  expiryRaw?: string
  expiryISO: string
  quantity: number
  unitLabel: string
  buyPriceRial: number
  consumerPriceRial?: number
  approvedPriceRial?: number
  priceDiffPct?: number
  drugId?: string
  catalogNameFa?: string
  matchStatus: ReconcileRowMatchStatus
  priceApproved?: boolean
  priceApprovedBy?: string
  locationLabel?: string
  binId?: string
}

export type ReconciliationSummary = {
  totalRows: number
  matchedCount: number
  matchedPercent: number
  newItemCount: number
  priceMismatchCount: number
  unapprovedMismatchCount: number
  grossRial: number
  discountRial: number
  vatRial: number
  netRial: number
  canConfirm: boolean
}

export type PurchaseReconciliation = {
  id: string
  status: ReconciliationStatus
  currentStep: 1 | 2 | 3
  fileName: string
  fileSizeBytes: number
  invoiceNo: string
  distributor: string
  issuedAt: string
  receivedAt: string
  warehouseLabel: string
  discountRial: number
  vatRial: number
  templateId: string
  headers: string[]
  columnLabels: string[]
  mapping: ColumnMapping
  rows: ReconciledRow[]
  quarantineOnIntake: boolean
  createdReceiptId?: string
  createdBatchIds?: string[]
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
  summary: ReconciliationSummary
}

export type ReconciliationHistoryItem = {
  id: string
  status: ReconciliationStatus
  currentStep: 1 | 2 | 3
  fileName: string
  fileSizeBytes: number
  invoiceNo: string
  distributor: string
  templateId: string
  createdReceiptId?: string
  quarantineOnIntake: boolean
  createdAt: string
  updatedAt: string
  confirmedAt?: string
  summary: ReconciliationSummary
}

export type ReconciliationRowFilter = 'all' | 'action_needed' | 'matched' | 'price_mismatch' | 'new_item'
