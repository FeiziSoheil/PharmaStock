import type {
  StocktakeCycle,
  StocktakeCycleListItem,
  StocktakeItem,
  StocktakeItemCountStatus,
  StocktakeMethod,
  StocktakeStatus,
  StocktakeSummary,
  StocktakeVarianceType,
} from '@/lib/types/stocktake'
import { apiBaseUrl } from './config'
import { apiRequest, handleUnauthorized } from './http'
import { getToken } from './session'

const STATUSES: readonly StocktakeStatus[] = [
  'active',
  'confirming',
  'confirmed',
  'cancelled',
]
const METHODS: readonly StocktakeMethod[] = ['blind', 'open']
const COUNT_STATUSES: readonly StocktakeItemCountStatus[] = [
  'pending',
  'counted',
  'skipped',
]
const VARIANCE_TYPES: readonly StocktakeVarianceType[] = [
  'pending',
  'skipped',
  'match',
  'shortage',
  'surplus',
]

type ApiSummary = Partial<StocktakeSummary>

type ApiItem = {
  id?: string
  batchId?: string
  drugId?: string
  nameFa?: string
  nameEn?: string
  gtin?: string
  genericCode?: string
  manufacturer?: string
  batchNo?: string
  expiry?: string
  zone?: string
  binId?: string
  locationLabel?: string
  unitLabel?: string
  isControlled?: boolean
  unitPriceRial?: number
  systemQty?: number
  physicalQty?: number
  varianceQty?: number
  varianceRial?: number
  varianceType?: string
  requiresSupervisor?: boolean
  countStatus?: string
  varianceReason?: string
  supervisorVerified?: boolean
  countedAt?: string
  countedBy?: string
}

type ApiCycle = {
  id?: string
  cycleCode?: string
  status?: string
  zone?: string
  zoneLabel?: string
  method?: string
  counterName?: string
  supervisorName?: string
  adjustmentDocNo?: string
  note?: string
  summary?: ApiSummary
  items?: ApiItem[] | null
  createdBy?: { userId?: string; name?: string; role?: string }
  createdAt?: string
  updatedAt?: string
  confirmedAt?: string
}

type ListEnvelope = {
  items?: ApiCycle[] | null
  total?: number
  page?: number
  pageSize?: number
  pageCount?: number
}

export type CreateStocktakeBody = {
  zone: string
  method: StocktakeMethod
  counterName?: string
  supervisorName?: string
  note?: string
}

export type UpdateStocktakeBody = {
  method?: StocktakeMethod
  counterName?: string
  supervisorName?: string
  note?: string
}

export type RecordStocktakeItemBody = {
  action: 'count' | 'skip' | 'recount' | 'verify' | 'note'
  physicalQty?: number
  varianceReason?: string
  supervisorVerified?: boolean
}

export type ConfirmStocktakeBody = {
  supervisorName?: string
  note?: string
  supervisorConfirm?: boolean
}

export type ListStocktakesQuery = {
  status?: StocktakeStatus
  page?: number
  pageSize?: number
}

export type ListStocktakesResult = {
  items: StocktakeCycleListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

function asStatus(v?: string): StocktakeStatus {
  return v && (STATUSES as readonly string[]).includes(v)
    ? (v as StocktakeStatus)
    : 'active'
}

function asMethod(v?: string): StocktakeMethod {
  return v && (METHODS as readonly string[]).includes(v)
    ? (v as StocktakeMethod)
    : 'blind'
}

function asCountStatus(v?: string): StocktakeItemCountStatus {
  return v && (COUNT_STATUSES as readonly string[]).includes(v)
    ? (v as StocktakeItemCountStatus)
    : 'pending'
}

function asVarianceType(v?: string): StocktakeVarianceType {
  return v && (VARIANCE_TYPES as readonly string[]).includes(v)
    ? (v as StocktakeVarianceType)
    : 'pending'
}

function mapSummary(raw?: ApiSummary): StocktakeSummary {
  return {
    totalItems: raw?.totalItems ?? 0,
    countedItems: raw?.countedItems ?? 0,
    skippedItems: raw?.skippedItems ?? 0,
    pendingItems: raw?.pendingItems ?? 0,
    progressPct: raw?.progressPct ?? 0,
    shortageUnits: raw?.shortageUnits ?? 0,
    shortageItemsCount: raw?.shortageItemsCount ?? 0,
    surplusUnits: raw?.surplusUnits ?? 0,
    surplusItemsCount: raw?.surplusItemsCount ?? 0,
    matchedItemsCount: raw?.matchedItemsCount ?? 0,
    highVarianceCount: raw?.highVarianceCount ?? 0,
    netVarianceRial: raw?.netVarianceRial ?? 0,
  }
}

function mapItem(raw: ApiItem): StocktakeItem {
  return {
    id: raw.id ?? '',
    batchId: raw.batchId ?? '',
    drugId: raw.drugId ?? '',
    nameFa: raw.nameFa ?? '',
    nameEn: raw.nameEn || undefined,
    gtin: raw.gtin || undefined,
    genericCode: raw.genericCode || undefined,
    manufacturer: raw.manufacturer || undefined,
    batchNo: raw.batchNo ?? '',
    expiry: raw.expiry ?? '',
    zone: raw.zone ?? '',
    binId: raw.binId ?? '',
    locationLabel: raw.locationLabel ?? '',
    unitLabel: raw.unitLabel?.trim() || 'عدد',
    isControlled: Boolean(raw.isControlled),
    unitPriceRial: raw.unitPriceRial ?? 0,
    systemQty: typeof raw.systemQty === 'number' ? raw.systemQty : undefined,
    physicalQty: typeof raw.physicalQty === 'number' ? raw.physicalQty : undefined,
    varianceQty: typeof raw.varianceQty === 'number' ? raw.varianceQty : undefined,
    varianceRial:
      typeof raw.varianceRial === 'number' ? raw.varianceRial : undefined,
    varianceType: asVarianceType(raw.varianceType),
    requiresSupervisor: Boolean(raw.requiresSupervisor),
    countStatus: asCountStatus(raw.countStatus),
    varianceReason: raw.varianceReason || undefined,
    supervisorVerified: Boolean(raw.supervisorVerified),
    countedAt: raw.countedAt || undefined,
    countedBy: raw.countedBy || undefined,
  }
}

function mapCycle(raw: ApiCycle): StocktakeCycle {
  return {
    id: raw.id ?? '',
    cycleCode: raw.cycleCode ?? '',
    status: asStatus(raw.status),
    zone: raw.zone ?? 'all',
    zoneLabel: raw.zoneLabel ?? '',
    method: asMethod(raw.method),
    counterName: raw.counterName ?? '',
    supervisorName: raw.supervisorName ?? '',
    adjustmentDocNo: raw.adjustmentDocNo || undefined,
    note: raw.note || undefined,
    summary: mapSummary(raw.summary),
    items: (raw.items ?? []).map(mapItem),
    createdBy: {
      userId: raw.createdBy?.userId ?? '',
      name: raw.createdBy?.name ?? '',
      role: raw.createdBy?.role ?? '',
    },
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    confirmedAt: raw.confirmedAt || undefined,
  }
}

function mapListItem(raw: ApiCycle): StocktakeCycleListItem {
  return {
    id: raw.id ?? '',
    cycleCode: raw.cycleCode ?? '',
    status: asStatus(raw.status),
    zone: raw.zone ?? 'all',
    zoneLabel: raw.zoneLabel ?? '',
    method: asMethod(raw.method),
    counterName: raw.counterName ?? '',
    supervisorName: raw.supervisorName ?? '',
    adjustmentDocNo: raw.adjustmentDocNo || undefined,
    summary: mapSummary(raw.summary),
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    confirmedAt: raw.confirmedAt || undefined,
  }
}

export async function listStocktakes(
  params: ListStocktakesQuery = {},
): Promise<ListStocktakesResult> {
  const res = await apiRequest<ListEnvelope>('/api/v1/stocktakes', {
    auth: true,
    query: {
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    },
  })
  return {
    items: (res.items ?? []).map(mapListItem),
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    pageSize: res.pageSize ?? params.pageSize ?? 25,
    pageCount: res.pageCount ?? 0,
  }
}

export async function createStocktake(
  body: CreateStocktakeBody,
): Promise<StocktakeCycle> {
  const res = await apiRequest<ApiCycle>('/api/v1/stocktakes', {
    method: 'POST',
    auth: true,
    body,
  })
  return mapCycle(res)
}

export async function getStocktake(id: string): Promise<StocktakeCycle> {
  const res = await apiRequest<ApiCycle>(`/api/v1/stocktakes/${id}`, {
    auth: true,
  })
  return mapCycle(res)
}

export async function updateStocktake(
  id: string,
  body: UpdateStocktakeBody,
): Promise<StocktakeCycle> {
  const res = await apiRequest<ApiCycle>(`/api/v1/stocktakes/${id}`, {
    method: 'PATCH',
    auth: true,
    body,
  })
  return mapCycle(res)
}

export async function recordStocktakeItem(
  cycleId: string,
  itemId: string,
  body: RecordStocktakeItemBody,
): Promise<StocktakeCycle> {
  const res = await apiRequest<ApiCycle>(
    `/api/v1/stocktakes/${cycleId}/items/${itemId}`,
    {
      method: 'PATCH',
      auth: true,
      body,
    },
  )
  return mapCycle(res)
}

export async function confirmStocktake(
  id: string,
  body: ConfirmStocktakeBody = {},
): Promise<StocktakeCycle> {
  const res = await apiRequest<ApiCycle>(`/api/v1/stocktakes/${id}/confirm`, {
    method: 'POST',
    auth: true,
    body,
  })
  return mapCycle(res)
}

export async function exportStocktakeCsv(id: string): Promise<{
  blob: Blob
  filename: string
}> {
  const token = getToken()
  if (!token) {
    handleUnauthorized()
    throw new Error('نشست منقضی شده است.')
  }
  const res = await fetch(`${apiBaseUrl()}/api/v1/stocktakes/${id}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('نشست منقضی شده است.')
  }
  if (!res.ok) {
    throw new Error('خطا در دریافت فایل خروجی اکسل')
  }
  const disposition = res.headers.get('content-disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const blob = await res.blob()
  return {
    blob,
    filename: match?.[1] ?? `stocktake-${id}.csv`,
  }
}
