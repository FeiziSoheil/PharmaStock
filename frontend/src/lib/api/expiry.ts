import type {
  ExpiryBatch,
  ExpiryBatchStatus,
  ExpiryKpis,
  GetExpiryBatchesResult,
} from '@/lib/types/expiry'
import type { DrugCategory } from '@/lib/types/drugs'
import type { ShelfZoneId } from '@/lib/types/shelves'
import type { ExpiryQueryParams, ExpiryStageTab } from '@/lib/expiry/expiry-query'
import { apiRequest } from './http'

type ApiExpiryRow = {
  batchId: string
  drugId: string
  nameFa: string
  nameEn?: string
  manufacturer?: string
  distributor?: string
  invoiceNo?: string
  batchNo: string
  expiry: string
  quantity: number
  unitLabel?: string
  locationLabel?: string
  storageNote?: string
  zone?: string
  category?: string
  isControlled?: boolean
  status: string
  bucket?: string
  daysUntilExpiry?: number
  productionISO?: string
  buyPriceRial?: number
  consumerPriceRial?: number
}

type ApiExpiryKpis = {
  expired: number
  critical: number
  warning: number
  watch: number
  ok?: number
  allAlerts?: number
  markedReturn?: number
}

type ListEnvelope = {
  items: ApiExpiryRow[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: ApiExpiryKpis
  fefoViolations?: unknown
}

function mapStageToQuery(stageTab?: ExpiryStageTab | ''): {
  bucket?: string
  status?: string
} {
  if (!stageTab || stageTab === 'all_alerts') return {}
  if (stageTab === 'marked_return') return { status: 'marked_return' }
  if (stageTab === 'expired') return { bucket: 'expired' }
  if (stageTab === 'critical') return { bucket: 'critical' }
  if (stageTab === 'warning') return { bucket: 'warning' }
  return {}
}

function mapBatch(raw: ApiExpiryRow): ExpiryBatch {
  return {
    batchId: raw.batchId,
    drugId: raw.drugId,
    nameFa: raw.nameFa,
    nameEn: raw.nameEn ?? '',
    manufacturer: raw.manufacturer ?? '',
    distributor: raw.distributor ?? '',
    invoiceNo: raw.invoiceNo ?? '',
    batchNo: raw.batchNo,
    expiry: raw.expiry,
    quantity: raw.quantity,
    unitLabel: raw.unitLabel ?? 'عدد',
    locationLabel: raw.locationLabel ?? '',
    storageNote: raw.storageNote ?? '',
    zone: (raw.zone as ShelfZoneId) || 'A',
    category: (raw.category as DrugCategory) || 'آنتی‌بیوتیک و ضدباکتری',
    isControlled: Boolean(raw.isControlled),
    status: (raw.status as ExpiryBatchStatus) || 'active',
    productionISO: raw.productionISO || undefined,
    buyPriceRial: raw.buyPriceRial ?? undefined,
    consumerPriceRial: raw.consumerPriceRial ?? undefined,
  }
}

function mapKpis(raw: ApiExpiryKpis): ExpiryKpis {
  const expired = raw.expired ?? 0
  const critical = raw.critical ?? 0
  const warning = raw.warning ?? 0
  const watch = raw.watch ?? 0
  const ok = raw.ok ?? 0
  return {
    expired,
    critical,
    warning,
    watch,
    ok,
    allAlerts: raw.allAlerts ?? expired + critical + warning + watch,
    markedReturn: raw.markedReturn ?? 0,
  }
}

export async function apiGetExpiryBatches(
  params: ExpiryQueryParams = {},
): Promise<GetExpiryBatchesResult> {
  const stage = params.bucket
    ? {}
    : mapStageToQuery(params.stageTab)

  const res = await apiRequest<ListEnvelope>('/api/v1/expiry-batches', {
    query: {
      search: params.search,
      bucket: params.bucket || stage.bucket || undefined,
      category: params.category || undefined,
      isControlled:
        params.isControlled === null || params.isControlled === undefined
          ? undefined
          : params.isControlled,
      zone: params.zone || undefined,
      status: params.status || stage.status || undefined,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      page: params.page,
      pageSize: params.pageSize,
    },
  })

  const items = (res.items ?? []).map(mapBatch)
  return {
    items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
    pageCount: res.pageCount,
    kpis: mapKpis(res.kpis ?? { expired: 0, critical: 0, warning: 0, watch: 0 }),
    allItems: items,
  }
}

export async function apiUpdateExpiryBatchStatus(
  batchId: string,
  status: ExpiryBatchStatus,
): Promise<ExpiryBatch | null> {
  try {
    const res = await apiRequest<ApiExpiryRow>(
      `/api/v1/expiry-batches/${batchId}/status`,
      { method: 'PATCH', body: { status } },
    )
    return mapBatch(res)
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: number }).status)
        : 0
    if (code === 404) return null
    throw err
  }
}

export type CreateExpiryBatchBody = {
  drugId: string
  batchNo: string
  expiry: string
  quantity: number
  unitLabel?: string
  locationLabel: string
  binId?: string
  manufacturer?: string
  distributor?: string
  invoiceNo?: string
  productionISO?: string
  buyPriceRial?: number
  consumerPriceRial?: number
  storageNote?: string
  nameEn?: string
  status?: ExpiryBatchStatus
}

export async function apiCreateExpiryBatch(
  body: CreateExpiryBatchBody,
): Promise<ExpiryBatch> {
  const res = await apiRequest<ApiExpiryRow>('/api/v1/expiry-batches', {
    method: 'POST',
    body,
  })
  return mapBatch(res)
}

export async function apiUpdateExpiryBatchLocation(
  batchId: string,
  input: { locationLabel: string; binId?: string; zone?: string },
): Promise<ExpiryBatch> {
  const res = await apiRequest<ApiExpiryRow>(
    `/api/v1/expiry-batches/${batchId}/location`,
    { method: 'PATCH', body: input },
  )
  return mapBatch(res)
}
