export type ReceiptStatus = 'draft' | 'confirmed' | 'cancelled'
export type PurchaseType = 'official_ttac' | 'official' | 'other'

export type ReceiptHeader = {
  invoiceNo: string
  distributor: string
  issuedAt: string
  receivedAt: string
  warehouseLabel: string
  purchaseType: PurchaseType
  discountRial: number
  vatRial: number
  note?: string
}

export type ReceiptLine = {
  id: string
  drugId: string
  nameFa: string
  gtin?: string
  irc?: string
  batchNo: string
  expiry: string
  quantity: number
  unitLabel: string
  buyPriceRial: number
  consumerPriceRial?: number
  locationLabel?: string
  binId?: string
  zone?: string
}

export type InvoiceReceipt = {
  id: string
  status: ReceiptStatus
  currentStep: 1 | 2 | 3
  header: ReceiptHeader
  lines: ReceiptLine[]
  createdBatchIds?: string[]
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
  grossRial?: number
  netRial?: number
}

export type ReceiptTotals = {
  grossRial: number
  discountRial: number
  vatRial: number
  netRial: number
}
