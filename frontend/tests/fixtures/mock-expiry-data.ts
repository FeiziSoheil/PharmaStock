import { MOCK_DRUGS, type Drug, type DrugCategory } from './mock-drugs-data'
import { SHELF_ZONES, type ShelfZoneId } from './mock-shelves-data'
import {
  applyExpiryQuery,
  countExpiryBuckets,
  type ExpiryQueryParams,
  type ExpiryQueryResult,
} from '@/lib/expiry/expiry-query'

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
}

export type ExpiryKpis = ReturnType<typeof countExpiryBuckets>

/** Fixed "today" for stable bucket distribution (injectable in queries/tests). */
export const MOCK_EXPIRY_TODAY = '2026-11-11'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function drugById(id: string): Drug {
  const drug = MOCK_DRUGS.find((item) => item.id === id)
  if (!drug) throw new Error(`Missing mock drug ${id}`)
  return drug
}

function addDays(isoDay: string, delta: number): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  date.setUTCDate(date.getUTCDate() + delta)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function zoneLabel(zone: ShelfZoneId): string {
  return SHELF_ZONES.find((z) => z.id === zone)?.label ?? zone
}

function makeBatch(input: {
  batchId: string
  drugId: string
  batchNo: string
  /** Days relative to MOCK_EXPIRY_TODAY */
  daysFromToday: number
  quantity: number
  unitLabel: string
  zone: ShelfZoneId
  locationLabel: string
  storageNote: string
  distributor: string
  invoiceNo: string
  nameEn?: string
  status?: ExpiryBatchStatus
  isControlled?: boolean
}): ExpiryBatch {
  const drug = drugById(input.drugId)
  return {
    batchId: input.batchId,
    drugId: input.drugId,
    nameFa: drug.nameFa,
    nameEn: input.nameEn ?? drug.brandName,
    manufacturer: drug.manufacturer,
    distributor: input.distributor,
    invoiceNo: input.invoiceNo,
    batchNo: input.batchNo,
    expiry: addDays(MOCK_EXPIRY_TODAY, input.daysFromToday),
    quantity: input.quantity,
    unitLabel: input.unitLabel,
    locationLabel: input.locationLabel,
    storageNote: input.storageNote,
    zone: input.zone,
    category: drug.category,
    isControlled: input.isControlled ?? drug.isControlled,
    status: input.status ?? 'active',
  }
}

/**
 * Seeded mock batches covering every expiry bucket, controlled+expired,
 * return-tracking, and a same-drug multi-batch FEFO pair.
 */
export const MOCK_EXPIRY_BATCHES: ExpiryBatch[] = [
  // —— expired ——
  makeBatch({
    batchId: 'eb-001',
    drugId: 'd-002',
    batchNo: 'B702-Jab',
    daysFromToday: -5,
    quantity: 10,
    unitLabel: 'بسته ۱۰ تایی',
    zone: 'R',
    locationLabel: 'قفسه سردخانه R-02',
    storageNote: 'دمای ۲ الی ۸ درجه',
    distributor: 'پخش هجرت (تهران غرب)',
    invoiceNo: '۱۴۰۲/۱۲۳۹',
    nameEn: 'Ceftriaxone 1g Powder for Injection',
  }),
  makeBatch({
    batchId: 'eb-002',
    drugId: 'd-004',
    batchNo: 'MOR-441',
    daysFromToday: -12,
    quantity: 4,
    unitLabel: 'آمپول',
    zone: 'S',
    locationLabel: 'گاوصندوق S-01',
    storageNote: 'تحت کنترل ویژه',
    distributor: 'داروپخش مرکزی',
    invoiceNo: '۱۴۰۲/۸۸۰۱',
    status: 'active',
  }),
  makeBatch({
    batchId: 'eb-003',
    drugId: 'd-023',
    batchNo: 'CX-OLD-11',
    daysFromToday: -2,
    quantity: 18,
    unitLabel: 'جعبه',
    zone: 'A',
    locationLabel: 'قفسه A-04 ردیف ۲',
    storageNote: 'دمای اتاق',
    distributor: 'سینا پخش ژن',
    invoiceNo: '۱۴۰۲/۲۲۰۰',
  }),
  makeBatch({
    batchId: 'eb-004',
    drugId: 'd-015',
    batchNo: 'ALP-902',
    daysFromToday: -20,
    quantity: 6,
    unitLabel: 'بلیستر',
    zone: 'S',
    locationLabel: 'گاوصندوق S-02',
    storageNote: 'تحت کنترل',
    distributor: 'شرکت توزیع رازی',
    invoiceNo: '۱۴۰۲/۵۵۱۰',
  }),

  // —— critical (≤30) ——
  makeBatch({
    batchId: 'eb-005',
    drugId: 'd-023',
    batchNo: 'CX500-449',
    daysFromToday: 12,
    quantity: 45,
    unitLabel: 'جعبه ۱۰۰ عددی',
    zone: 'B',
    locationLabel: 'قفسه B-14 ردیف ۳',
    storageNote: 'دمای زیر ۲۵ درجه (خشک)',
    distributor: 'داروپخش سراسری',
    invoiceNo: '۱۴۰۲/۹۸۳۱',
    nameEn: 'Cephalexin 500mg',
  }),
  makeBatch({
    batchId: 'eb-006',
    drugId: 'd-024',
    batchNo: 'CIP-9031',
    daysFromToday: 22,
    quantity: 28,
    unitLabel: 'بطری ۵ میلی‌لیتر',
    zone: 'A',
    locationLabel: 'قفسه چشمی E-03',
    storageNote: 'محافظت از تابش نور',
    distributor: 'شرکت توزیع رازی',
    invoiceNo: '۱۴۰۲/۵۶۴۳',
    nameEn: 'Ciprofloxacin Ophth Drop',
  }),
  makeBatch({
    batchId: 'eb-007',
    drugId: 'd-006',
    batchNo: 'AMX-119',
    daysFromToday: 0,
    quantity: 32,
    unitLabel: 'جعبه',
    zone: 'A',
    locationLabel: 'قفسه A-01 ردیف ۱',
    storageNote: 'دمای اتاق',
    distributor: 'داروپخش سراسری',
    invoiceNo: '۱۴۰۳/۰۱۰۱',
  }),
  makeBatch({
    batchId: 'eb-008',
    drugId: 'd-003',
    batchNo: 'INS-G-55',
    daysFromToday: 8,
    quantity: 14,
    unitLabel: 'قلم',
    zone: 'R',
    locationLabel: 'یخچال شماره ۱ طبقه ۲',
    storageNote: 'دمای ۲ الی ۸ درجه',
    distributor: 'داروپخش مرکزی',
    invoiceNo: '۱۴۰۳/۰۹۹۰',
  }),
  makeBatch({
    batchId: 'eb-009',
    drugId: 'd-011',
    batchNo: 'ATV20-77',
    daysFromToday: 30,
    quantity: 50,
    unitLabel: 'بلیستر ۳۰ عددی',
    zone: 'A',
    locationLabel: 'قفسه قلبی C-08',
    storageNote: 'دمای ۱۵ الی ۳۰ درجه',
    distributor: 'سینا پخش ژن',
    invoiceNo: '۱۴۰۳/۰۳۳۳',
  }),

  // —— warning (31–90) ——
  makeBatch({
    batchId: 'eb-010',
    drugId: 'd-011',
    batchNo: 'ATV20-88',
    daysFromToday: 48,
    quantity: 120,
    unitLabel: 'بلیستر ۳۰ عددی',
    zone: 'A',
    locationLabel: 'قفسه قلبی C-09',
    storageNote: 'دمای ۱۵ الی ۳۰ درجه',
    distributor: 'سینا پخش ژن',
    invoiceNo: '۱۴۰۳/۰۴۱۱',
    nameEn: 'Atorvastatin 20mg',
  }),
  makeBatch({
    batchId: 'eb-011',
    drugId: 'd-001',
    batchNo: 'MET-501',
    daysFromToday: 60,
    quantity: 80,
    unitLabel: 'جعبه',
    zone: 'A',
    locationLabel: 'قفسه A-02 ردیف ۴',
    storageNote: 'دمای اتاق',
    distributor: 'داروپخش سراسری',
    invoiceNo: '۱۴۰۳/۰۷۷۷',
  }),
  makeBatch({
    batchId: 'eb-012',
    drugId: 'd-008',
    batchNo: 'AZI-220',
    daysFromToday: 75,
    quantity: 36,
    unitLabel: 'بلیستر',
    zone: 'B',
    locationLabel: 'قفسه B-03',
    storageNote: 'خشک و خنک',
    distributor: 'پخش هجرت (تهران غرب)',
    invoiceNo: '۱۴۰۳/۰۸۸۸',
  }),
  makeBatch({
    batchId: 'eb-013',
    drugId: 'd-019',
    batchNo: 'SAL-331',
    daysFromToday: 90,
    quantity: 22,
    unitLabel: 'اسپری',
    zone: 'A',
    locationLabel: 'قفسه تنفسی T-02',
    storageNote: 'دور از گرما',
    distributor: 'شرکت توزیع رازی',
    invoiceNo: '۱۴۰۳/۰۹۱۲',
    status: 'marked_return',
  }),

  // —— watch (91–180) ——
  makeBatch({
    batchId: 'eb-014',
    drugId: 'd-031',
    batchNo: 'ENX-710',
    daysFromToday: 92,
    quantity: 60,
    unitLabel: 'سرنگ آماده تزریق',
    zone: 'R',
    locationLabel: 'یخچال شماره ۱ طبقه ۲',
    storageNote: 'دمای ۲ الی ۸ درجه',
    distributor: 'داروپخش مرکزی',
    invoiceNo: '۱۴۰۳/۱۱۴۰',
    nameEn: 'Enoxaparin 4000 IU Injection',
  }),
  makeBatch({
    batchId: 'eb-015',
    drugId: 'd-009',
    batchNo: 'LOS-441',
    daysFromToday: 120,
    quantity: 95,
    unitLabel: 'جعبه',
    zone: 'A',
    locationLabel: 'قفسه قلبی C-01',
    storageNote: 'دمای اتاق',
    distributor: 'سینا پخش ژن',
    invoiceNo: '۱۴۰۳/۱۲۰۱',
  }),
  makeBatch({
    batchId: 'eb-016',
    drugId: 'd-012',
    batchNo: 'OMZ-880',
    daysFromToday: 150,
    quantity: 70,
    unitLabel: 'کپسول',
    zone: 'A',
    locationLabel: 'قفسه گوارش G-05',
    storageNote: 'دمای اتاق',
    distributor: 'داروپخش سراسری',
    invoiceNo: '۱۴۰۳/۱۳۰۰',
  }),
  makeBatch({
    batchId: 'eb-017',
    drugId: 'd-005',
    batchNo: 'ACT-991',
    daysFromToday: 180,
    quantity: 200,
    unitLabel: 'جعبه',
    zone: 'C',
    locationLabel: 'پیشخوان C-01',
    storageNote: 'دمای اتاق',
    distributor: 'پخش هجرت (تهران غرب)',
    invoiceNo: '۱۴۰۳/۱۴۰۰',
    status: 'marked_return',
  }),

  // —— ok (>180) ——
  makeBatch({
    batchId: 'eb-018',
    drugId: 'd-017',
    batchNo: 'IBU-550',
    daysFromToday: 200,
    quantity: 140,
    unitLabel: 'جعبه',
    zone: 'A',
    locationLabel: 'قفسه A-10',
    storageNote: 'دمای اتاق',
    distributor: 'داروپخش سراسری',
    invoiceNo: '۱۴۰۳/۱۵۰۰',
  }),
  makeBatch({
    batchId: 'eb-019',
    drugId: 'd-021',
    batchNo: 'VD3-101',
    daysFromToday: 250,
    quantity: 88,
    unitLabel: 'قرص',
    zone: 'A',
    locationLabel: 'قفسه ویتامین V-02',
    storageNote: 'دمای اتاق',
    distributor: 'سینا پخش ژن',
    invoiceNo: '۱۴۰۳/۱۶۰۰',
  }),
  makeBatch({
    batchId: 'eb-020',
    drugId: 'd-010',
    batchNo: 'AML-303',
    daysFromToday: 300,
    quantity: 110,
    unitLabel: 'جعبه',
    zone: 'A',
    locationLabel: 'قفسه قلبی C-03',
    storageNote: 'دمای اتاق',
    distributor: 'داروپخش مرکزی',
    invoiceNo: '۱۴۰۳/۱۷۰۰',
  }),
  makeBatch({
    batchId: 'eb-021',
    drugId: 'd-020',
    batchNo: 'LOR-404',
    daysFromToday: 365,
    quantity: 75,
    unitLabel: 'جعبه',
    zone: 'B',
    locationLabel: 'قفسه B-08',
    storageNote: 'خشک',
    distributor: 'شرکت توزیع رازی',
    invoiceNo: '۱۴۰۳/۱۸۰۰',
  }),

  // FEFO pair for d-006: older + newer (violation appears when newer is sorted ahead)
  makeBatch({
    batchId: 'eb-022',
    drugId: 'd-006',
    batchNo: 'AMX-NEW-99',
    daysFromToday: 400,
    quantity: 60,
    unitLabel: 'جعبه',
    zone: 'A',
    locationLabel: 'قفسه A-01 ردیف ۲',
    storageNote: 'دمای اتاق',
    distributor: 'داروپخش سراسری',
    invoiceNo: '۱۴۰۳/۱۹۰۰',
  }),

  // Extra return-tracking + critical
  makeBatch({
    batchId: 'eb-023',
    drugId: 'd-029',
    batchNo: 'CLN-210',
    daysFromToday: 18,
    quantity: 9,
    unitLabel: 'جعبه',
    zone: 'S',
    locationLabel: 'گاوصندوق S-03',
    storageNote: 'تحت کنترل',
    distributor: 'داروپخش مرکزی',
    invoiceNo: '۱۴۰۳/۲۰۱۰',
    status: 'marked_return',
  }),
  makeBatch({
    batchId: 'eb-024',
    drugId: 'd-007',
    batchNo: 'AMC-660',
    daysFromToday: 40,
    quantity: 55,
    unitLabel: 'جعبه',
    zone: 'A',
    locationLabel: 'قفسه A-06',
    storageNote: 'دمای اتاق',
    distributor: 'پخش هجرت (تهران غرب)',
    invoiceNo: '۱۴۰۳/۲۱۰۰',
  }),
]

let runtimeStore: ExpiryBatch[] | null = null

function getStore(): ExpiryBatch[] {
  if (!runtimeStore) {
    runtimeStore = MOCK_EXPIRY_BATCHES.map((row) => ({ ...row }))
  }
  return runtimeStore
}

/** Reset mutable mock state (tests / reload semantics). */
export function resetExpiryBatches(): void {
  runtimeStore = null
}

export type GetExpiryBatchesResult = ExpiryQueryResult & {
  kpis: ExpiryKpis
  allItems: ExpiryBatch[]
}

export async function getExpiryBatches(
  params: ExpiryQueryParams = {},
): Promise<GetExpiryBatchesResult> {
  await delay(120)
  const store = getStore()
  const today =
    params.today ??
    new Date(
      Number(MOCK_EXPIRY_TODAY.slice(0, 4)),
      Number(MOCK_EXPIRY_TODAY.slice(5, 7)) - 1,
      Number(MOCK_EXPIRY_TODAY.slice(8, 10)),
    )
  const query = applyExpiryQuery(store, { ...params, today })
  const kpis = countExpiryBuckets(store, today)
  return { ...query, kpis, allItems: store }
}

export async function updateExpiryBatchStatus(
  batchId: string,
  status: ExpiryBatchStatus,
): Promise<ExpiryBatch | null> {
  await delay(80)
  const store = getStore()
  const row = store.find((item) => item.batchId === batchId)
  if (!row) return null
  row.status = status
  return { ...row }
}

export { zoneLabel }

export const FIXTURE_EXPIRY_BATCHES = MOCK_EXPIRY_BATCHES
export const FIXTURE_EXPIRY_TODAY = MOCK_EXPIRY_TODAY
