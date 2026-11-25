export const SHELF_ZONES = [
  { id: 'A', label: 'سالن اصلی A (داروهای روتین)' },
  { id: 'B', label: 'سالن B (سرم و حجیم)' },
  { id: 'C', label: 'پیشخوان تحویل نسخه' },
  { id: 'R', label: 'اتاق سرد / زنجیره سرد' },
  { id: 'S', label: 'اتاق حفاظت‌شده (گاوصندوق)' },
] as const

export type ShelfZoneId = (typeof SHELF_ZONES)[number]['id']

export type ShelfBinStatus =
  | 'empty'
  | 'occupied'
  | 'low'
  | 'expiring'
  | 'controlled'

export type ShelfStockStatusFilter = ShelfBinStatus

export type ShelfBatch = {
  drugId: string
  nameFa: string
  batchNo: string
  /** ISO calendar date YYYY-MM-DD */
  expiry: string
  quantity: number
}

export type ShelfBin = {
  id: string
  zone: ShelfZoneId
  zoneLabel: string
  rack: string
  shelf: string
  bin: string
  /** LTR technical address e.g. A-03-2-04 */
  address: string
  isControlled: boolean
  capacity: number
  batches: ShelfBatch[]
  /** Macro location badge label matching Stitch tabs */
  macroLocation: 'main' | 'dispensing' | 'cold' | 'controlled'
}

export type ShelfKpis = {
  capacityPct: number
  occupiedBins: number
  totalBins: number
  emptyBins: number
  dispensingReady: number
  replenishNeeded: number
  coldTempC: number
}
