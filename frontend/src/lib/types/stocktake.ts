export type StocktakeStatus = 'active' | 'confirming' | 'confirmed' | 'cancelled'

export type StocktakeMethod = 'blind' | 'open'

export type StocktakeItemCountStatus = 'pending' | 'counted' | 'skipped'

export type StocktakeVarianceType =
  | 'pending'
  | 'skipped'
  | 'match'
  | 'shortage'
  | 'surplus'

export type StocktakeVarianceFilter =
  | 'all'
  | 'shortage'
  | 'surplus'
  | 'match'
  | 'uncounted'

export type StocktakeZoneOption = 'all' | 'A' | 'C' | 'R' | 'S'

export type StocktakeSummary = {
  totalItems: number
  countedItems: number
  skippedItems: number
  pendingItems: number
  progressPct: number
  shortageUnits: number
  shortageItemsCount: number
  surplusUnits: number
  surplusItemsCount: number
  matchedItemsCount: number
  highVarianceCount: number
  netVarianceRial: number
}

export type StocktakeItem = {
  id: string
  batchId: string
  drugId: string
  nameFa: string
  nameEn?: string
  gtin?: string
  genericCode?: string
  manufacturer?: string
  batchNo: string
  expiry: string
  zone: string
  binId: string
  locationLabel: string
  unitLabel: string
  isControlled: boolean
  unitPriceRial: number
  systemQty?: number
  physicalQty?: number
  varianceQty?: number
  varianceRial?: number
  varianceType: StocktakeVarianceType
  requiresSupervisor: boolean
  countStatus: StocktakeItemCountStatus
  varianceReason?: string
  supervisorVerified: boolean
  countedAt?: string
  countedBy?: string
}

export type StocktakeCycle = {
  id: string
  cycleCode: string
  status: StocktakeStatus
  zone: string
  zoneLabel: string
  method: StocktakeMethod
  counterName: string
  supervisorName: string
  adjustmentDocNo?: string
  note?: string
  summary: StocktakeSummary
  items: StocktakeItem[]
  createdBy: {
    userId: string
    name: string
    role: string
  }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
}

export type StocktakeCycleListItem = {
  id: string
  cycleCode: string
  status: StocktakeStatus
  zone: string
  zoneLabel: string
  method: StocktakeMethod
  counterName: string
  supervisorName: string
  adjustmentDocNo?: string
  summary: StocktakeSummary
  createdAt: string
  updatedAt: string
  confirmedAt?: string
}

export const STOCKTAKE_ZONE_OPTIONS: ReadonlyArray<{
  value: StocktakeZoneOption
  label: string
}> = [
  { value: 'all', label: 'همه بخش‌ها و قفسه‌های انبار' },
  { value: 'A', label: 'سالن اصلی انبار دارو (قفسه‌های زون A)' },
  { value: 'C', label: 'قفسه‌های پیشخوان تحویل نسخه (زون C)' },
  { value: 'R', label: 'یخچال و سردخانه بیولوژیک (۲ تا ۸ درجه - زون R)' },
  { value: 'S', label: 'انبار اقلام تحت کنترل و مواد مخدر (زون S)' },
]

export const VARIANCE_REASON_PRESETS: readonly string[] = [
  'شمارش مطابق کاردکس',
  'شکستگی حین تخلیه بار',
  'عدم ثبت رسید فاکتور خرید',
  'خطای نسخه‌پیچی در بخش بیمه',
  'کسری احتمالی نسخه‌پیچی ثبت‌نشده',
  'عدم ثبت مرجوعی قفسه',
]
