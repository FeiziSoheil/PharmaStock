import type {
  ColumnMapping,
  PurchaseReconciliation,
  ReconciledRow,
  ReconcileRowMatchStatus,
  ReconciliationHistoryItem,
  ReconciliationStatus,
  ReconciliationSummary,
} from '@/lib/types/reconciliation'
import { apiBaseUrl } from './config'
import { ApiError, apiRequest, handleUnauthorized } from './http'
import { getToken } from './session'

const STATUSES: readonly ReconciliationStatus[] = [
  'uploaded',
  'mapped',
  'confirmed',
  'cancelled',
]

const ROW_STATUSES: readonly ReconcileRowMatchStatus[] = [
  'matched',
  'new_item',
  'price_mismatch',
]

type ApiMapping = Partial<ColumnMapping>
type ApiSummary = Partial<ReconciliationSummary>
type ApiRow = Partial<ReconciledRow>

type ApiReconciliation = {
  id?: string
  status?: string
  currentStep?: number
  fileName?: string
  fileSizeBytes?: number
  invoiceNo?: string
  distributor?: string
  issuedAt?: string
  receivedAt?: string
  warehouseLabel?: string
  discountRial?: number
  vatRial?: number
  templateId?: string
  headers?: string[] | null
  columnLabels?: string[] | null
  mapping?: ApiMapping
  rows?: ApiRow[] | null
  quarantineOnIntake?: boolean
  createdReceiptId?: string
  createdBatchIds?: string[] | null
  createdBy?: { userId?: string; name?: string; role?: string }
  createdAt?: string
  updatedAt?: string
  confirmedAt?: string
  summary?: ApiSummary
}

type ApiHistoryItem = {
  id?: string
  status?: string
  currentStep?: number
  fileName?: string
  fileSizeBytes?: number
  invoiceNo?: string
  distributor?: string
  templateId?: string
  createdReceiptId?: string
  quarantineOnIntake?: boolean
  createdAt?: string
  updatedAt?: string
  confirmedAt?: string
  summary?: ApiSummary
}

type HistoryEnvelope = {
  items?: ApiHistoryItem[] | null
  total?: number
  page?: number
  pageSize?: number
  pageCount?: number
}

export type UploadReconciliationParams = {
  file: File
  invoiceNo?: string
  distributor?: string
  issuedAt?: string
  receivedAt?: string
  warehouseLabel?: string
  templateId?: string
  discountRial?: number
  vatRial?: number
}

export type DraftPatchBody = {
  invoiceNo?: string
  distributor?: string
  issuedAt?: string
  receivedAt?: string
  warehouseLabel?: string
  discountRial?: number
  vatRial?: number
  quarantineOnIntake?: boolean
  currentStep?: 1 | 2 | 3
}

export type MappingPatchBody = {
  templateId?: string
  mapping?: ColumnMapping
  goToStep3?: boolean
}

export type RowPatchBody = {
  drugId?: string
  excelName?: string
  gtin?: string
  irc?: string
  batchNo?: string
  expiryRaw?: string
  expiryISO?: string
  quantity?: number
  unitLabel?: string
  buyPriceRial?: number
  consumerPriceRial?: number
  priceApproved?: boolean
  locationLabel?: string
  binId?: string
}

function normalizeStatus(value?: string): ReconciliationStatus {
  if (value && (STATUSES as readonly string[]).includes(value)) {
    return value as ReconciliationStatus
  }
  return 'mapped'
}

function normalizeRowStatus(value?: string): ReconcileRowMatchStatus {
  if (value && (ROW_STATUSES as readonly string[]).includes(value)) {
    return value as ReconcileRowMatchStatus
  }
  return 'new_item'
}

function normalizeStep(value?: number): 1 | 2 | 3 {
  if (value === 1 || value === 3) return value
  return 2
}

function mapMapping(raw?: ApiMapping): ColumnMapping {
  return {
    nameFa: raw?.nameFa ?? -1,
    gtin: raw?.gtin ?? -1,
    irc: raw?.irc ?? -1,
    batchNo: raw?.batchNo ?? -1,
    expiry: raw?.expiry ?? -1,
    quantity: raw?.quantity ?? -1,
    buyPriceRial: raw?.buyPriceRial ?? -1,
    consumerPriceRial: raw?.consumerPriceRial ?? -1,
    unitLabel: raw?.unitLabel ?? -1,
  }
}

function mapRow(raw: ApiRow): ReconciledRow {
  return {
    id: raw.id ?? '',
    rowNumber: raw.rowNumber ?? 0,
    excelName: raw.excelName ?? '',
    gtin: raw.gtin || undefined,
    irc: raw.irc || undefined,
    batchNo: raw.batchNo ?? '',
    expiryRaw: raw.expiryRaw || undefined,
    expiryISO: raw.expiryISO ?? '',
    quantity: raw.quantity ?? 0,
    unitLabel: raw.unitLabel || 'عدد',
    buyPriceRial: raw.buyPriceRial ?? 0,
    consumerPriceRial:
      typeof raw.consumerPriceRial === 'number' ? raw.consumerPriceRial : undefined,
    approvedPriceRial:
      typeof raw.approvedPriceRial === 'number' ? raw.approvedPriceRial : undefined,
    priceDiffPct:
      typeof raw.priceDiffPct === 'number' ? raw.priceDiffPct : undefined,
    drugId: raw.drugId || undefined,
    catalogNameFa: raw.catalogNameFa || undefined,
    matchStatus: normalizeRowStatus(raw.matchStatus),
    priceApproved: Boolean(raw.priceApproved),
    priceApprovedBy: raw.priceApprovedBy || undefined,
    locationLabel: raw.locationLabel || undefined,
    binId: raw.binId || undefined,
  }
}

function mapSummary(raw?: ApiSummary): ReconciliationSummary {
  return {
    totalRows: raw?.totalRows ?? 0,
    matchedCount: raw?.matchedCount ?? 0,
    matchedPercent: raw?.matchedPercent ?? 0,
    newItemCount: raw?.newItemCount ?? 0,
    priceMismatchCount: raw?.priceMismatchCount ?? 0,
    unapprovedMismatchCount: raw?.unapprovedMismatchCount ?? 0,
    grossRial: raw?.grossRial ?? 0,
    discountRial: raw?.discountRial ?? 0,
    vatRial: raw?.vatRial ?? 0,
    netRial: raw?.netRial ?? 0,
    canConfirm: Boolean(raw?.canConfirm),
  }
}

function mapReconciliation(raw: ApiReconciliation): PurchaseReconciliation {
  const createdBatchIds = raw.createdBatchIds?.filter(Boolean)
  return {
    id: raw.id ?? '',
    status: normalizeStatus(raw.status),
    currentStep: normalizeStep(raw.currentStep),
    fileName: raw.fileName ?? '',
    fileSizeBytes: raw.fileSizeBytes ?? 0,
    invoiceNo: raw.invoiceNo ?? '',
    distributor: raw.distributor ?? '',
    issuedAt: raw.issuedAt ?? '',
    receivedAt: raw.receivedAt ?? '',
    warehouseLabel: raw.warehouseLabel ?? '',
    discountRial: raw.discountRial ?? 0,
    vatRial: raw.vatRial ?? 0,
    templateId: raw.templateId ?? 'hijrat',
    headers: raw.headers ?? [],
    columnLabels: raw.columnLabels ?? [],
    mapping: mapMapping(raw.mapping),
    rows: (raw.rows ?? []).map(mapRow),
    quarantineOnIntake: raw.quarantineOnIntake ?? true,
    createdReceiptId: raw.createdReceiptId || undefined,
    createdBatchIds: createdBatchIds?.length ? createdBatchIds : undefined,
    createdBy: {
      userId: raw.createdBy?.userId ?? '',
      name: raw.createdBy?.name ?? '',
      role: raw.createdBy?.role ?? '',
    },
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    confirmedAt: raw.confirmedAt || undefined,
    summary: mapSummary(raw.summary),
  }
}

function mapHistoryItem(raw: ApiHistoryItem): ReconciliationHistoryItem {
  return {
    id: raw.id ?? '',
    status: normalizeStatus(raw.status),
    currentStep: normalizeStep(raw.currentStep),
    fileName: raw.fileName ?? '',
    fileSizeBytes: raw.fileSizeBytes ?? 0,
    invoiceNo: raw.invoiceNo ?? '',
    distributor: raw.distributor ?? '',
    templateId: raw.templateId ?? 'hijrat',
    createdReceiptId: raw.createdReceiptId || undefined,
    quarantineOnIntake: raw.quarantineOnIntake ?? true,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    confirmedAt: raw.confirmedAt || undefined,
    summary: mapSummary(raw.summary),
  }
}

export async function apiDownloadReconciliationTemplate(): Promise<Blob> {
  const token = getToken()
  if (!token) {
    handleUnauthorized()
    throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.', 'unauthorized')
  }
  let res: Response
  try {
    res = await fetch(`${apiBaseUrl()}/api/v1/reconciliations/template`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError(0, 'خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.', 'network_error')
  }
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized()
    throw new ApiError(res.status, 'دریافت فایل نمونه اکسل با خطا مواجه شد.')
  }
  return res.blob()
}

export async function apiUploadReconciliationFile(
  params: UploadReconciliationParams,
): Promise<PurchaseReconciliation> {
  const token = getToken()
  if (!token) {
    handleUnauthorized()
    throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.', 'unauthorized')
  }
  const form = new FormData()
  form.append('file', params.file)
  if (params.invoiceNo) form.append('invoiceNo', params.invoiceNo)
  if (params.distributor) form.append('distributor', params.distributor)
  if (params.issuedAt) form.append('issuedAt', params.issuedAt)
  if (params.receivedAt) form.append('receivedAt', params.receivedAt)
  if (params.warehouseLabel) form.append('warehouseLabel', params.warehouseLabel)
  if (params.templateId) form.append('templateId', params.templateId)
  if (typeof params.discountRial === 'number') {
    form.append('discountRial', String(params.discountRial))
  }
  if (typeof params.vatRial === 'number') {
    form.append('vatRial', String(params.vatRial))
  }

  let res: Response
  try {
    res = await fetch(`${apiBaseUrl()}/api/v1/reconciliations/upload`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })
  } catch {
    throw new ApiError(0, 'خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.', 'network_error')
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized()
    const obj = (data && typeof data === 'object' ? data : {}) as {
      message?: string
      code?: string
      fields?: unknown
    }
    throw new ApiError(
      res.status,
      obj.message ?? 'بارگذاری و پردازش فایل با خطا مواجه شد.',
      obj.code,
      obj.fields,
    )
  }
  return mapReconciliation(data as ApiReconciliation)
}

export async function apiListReconciliations(params: {
  status?: ReconciliationStatus
  page?: number
  pageSize?: number
} = {}): Promise<{
  items: ReconciliationHistoryItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}> {
  const res = await apiRequest<HistoryEnvelope>('/api/v1/reconciliations', {
    auth: true,
    query: {
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    },
  })
  return {
    items: (res.items ?? []).map(mapHistoryItem),
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    pageSize: res.pageSize ?? params.pageSize ?? 25,
    pageCount: res.pageCount ?? 0,
  }
}

export async function apiGetReconciliation(
  id: string,
): Promise<PurchaseReconciliation> {
  const res = await apiRequest<ApiReconciliation>(`/api/v1/reconciliations/${id}`, {
    auth: true,
  })
  return mapReconciliation(res)
}

export async function apiPatchReconciliation(
  id: string,
  body: DraftPatchBody,
): Promise<PurchaseReconciliation> {
  const res = await apiRequest<ApiReconciliation>(`/api/v1/reconciliations/${id}`, {
    method: 'PATCH',
    auth: true,
    body,
  })
  return mapReconciliation(res)
}

export async function apiUpdateReconciliationMapping(
  id: string,
  body: MappingPatchBody,
): Promise<PurchaseReconciliation> {
  const res = await apiRequest<ApiReconciliation>(
    `/api/v1/reconciliations/${id}/mapping`,
    {
      method: 'PATCH',
      auth: true,
      body,
    },
  )
  return mapReconciliation(res)
}

export async function apiRematchReconciliation(
  id: string,
  body: { rowId?: string; drugId?: string } = {},
): Promise<PurchaseReconciliation> {
  const res = await apiRequest<ApiReconciliation>(
    `/api/v1/reconciliations/${id}/rematch`,
    {
      method: 'POST',
      auth: true,
      body,
    },
  )
  return mapReconciliation(res)
}

export async function apiPatchReconciliationRow(
  id: string,
  rowId: string,
  body: RowPatchBody,
): Promise<PurchaseReconciliation> {
  const res = await apiRequest<ApiReconciliation>(
    `/api/v1/reconciliations/${id}/rows/${rowId}`,
    {
      method: 'PATCH',
      auth: true,
      body,
    },
  )
  return mapReconciliation(res)
}

export async function apiDeleteReconciliationRow(
  id: string,
  rowId: string,
): Promise<PurchaseReconciliation> {
  const res = await apiRequest<ApiReconciliation>(
    `/api/v1/reconciliations/${id}/rows/${rowId}`,
    {
      method: 'DELETE',
      auth: true,
    },
  )
  return mapReconciliation(res)
}

export async function apiConfirmReconciliation(
  id: string,
): Promise<PurchaseReconciliation> {
  const res = await apiRequest<ApiReconciliation>(
    `/api/v1/reconciliations/${id}/confirm`,
    {
      method: 'POST',
      auth: true,
    },
  )
  return mapReconciliation(res)
}
