import type {
  InvoiceReceipt,
  PurchaseType,
  ReceiptHeader,
  ReceiptLine,
  ReceiptStatus,
} from '@/lib/types/receipts'
import { computeReceiptTotals } from '@/lib/receipts/totals'
import { apiRequest } from './http'

const PURCHASE_TYPES: readonly PurchaseType[] = ['official_ttac', 'official', 'other']
const STATUSES: readonly ReceiptStatus[] = ['draft', 'confirmed', 'cancelled']

type ApiHeader = {
  invoiceNo?: string
  distributor?: string
  issuedAt?: string
  receivedAt?: string
  warehouseLabel?: string
  purchaseType?: string
  discountRial?: number
  vatRial?: number
  note?: string
}

type ApiLine = {
  id?: string
  drugId?: string
  nameFa?: string
  gtin?: string
  irc?: string
  batchNo?: string
  expiry?: string
  quantity?: number
  unitLabel?: string
  buyPriceRial?: number
  consumerPriceRial?: number
  locationLabel?: string
  binId?: string
  zone?: string
}

type ApiReceipt = {
  id?: string
  status?: string
  currentStep?: number
  header?: ApiHeader
  lines?: ApiLine[] | null
  createdBatchIds?: string[]
  createdBy?: { userId?: string; name?: string; role?: string }
  createdAt?: string
  updatedAt?: string
  confirmedAt?: string
  grossRial?: number
  netRial?: number
}

type ListEnvelope = {
  items?: ApiReceipt[] | null
  total?: number
  page?: number
  pageSize?: number
  pageCount?: number
}

export type ListReceiptsQuery = {
  status?: ReceiptStatus
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export type ListReceiptsResult = {
  items: InvoiceReceipt[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

/** Partial draft header. Omitted fields stay unchanged on the server. */
export type ReceiptHeaderPatch = {
  invoiceNo?: string
  distributor?: string
  issuedAt?: string
  receivedAt?: string
  warehouseLabel?: string
  purchaseType?: PurchaseType
  discountRial?: number
  vatRial?: number
  note?: string
  currentStep?: 1 | 2 | 3
}

/** New line body. `nameFa` is filled from the drug catalog. */
export type ReceiptLineInput = {
  drugId: string
  batchNo: string
  expiry: string
  quantity: number
  unitLabel?: string
  buyPriceRial: number
  consumerPriceRial?: number
  gtin?: string
  irc?: string
  locationLabel?: string
  binId?: string
  zone?: string
}

/** Partial line edit. Omitted fields stay unchanged on the server. */
export type ReceiptLinePatch = {
  drugId?: string
  batchNo?: string
  expiry?: string
  quantity?: number
  unitLabel?: string
  buyPriceRial?: number
  consumerPriceRial?: number
  gtin?: string
  irc?: string
  locationLabel?: string
  binId?: string
  zone?: string
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function purchaseType(value: string | undefined): PurchaseType {
  if (value && (PURCHASE_TYPES as readonly string[]).includes(value)) {
    return value as PurchaseType
  }
  return 'other'
}

function receiptStatus(value: string | undefined): ReceiptStatus {
  if (value && (STATUSES as readonly string[]).includes(value)) {
    return value as ReceiptStatus
  }
  return 'draft'
}

function currentStep(value: number | undefined): 1 | 2 | 3 {
  if (value === 2 || value === 3) return value
  return 1
}

function mapHeader(raw: ApiHeader | undefined): ReceiptHeader {
  return {
    invoiceNo: raw?.invoiceNo ?? '',
    distributor: raw?.distributor ?? '',
    issuedAt: raw?.issuedAt ?? '',
    receivedAt: raw?.receivedAt ?? '',
    warehouseLabel: raw?.warehouseLabel ?? '',
    purchaseType: purchaseType(raw?.purchaseType),
    discountRial: raw?.discountRial ?? 0,
    vatRial: raw?.vatRial ?? 0,
    note: optionalText(raw?.note),
  }
}

function mapLine(raw: ApiLine): ReceiptLine {
  return {
    id: raw.id ?? '',
    drugId: raw.drugId ?? '',
    nameFa: raw.nameFa ?? '',
    gtin: optionalText(raw.gtin),
    irc: optionalText(raw.irc),
    batchNo: raw.batchNo ?? '',
    expiry: raw.expiry ?? '',
    quantity: raw.quantity ?? 0,
    unitLabel: raw.unitLabel?.trim() || 'عدد',
    buyPriceRial: raw.buyPriceRial ?? 0,
    consumerPriceRial:
      typeof raw.consumerPriceRial === 'number' ? raw.consumerPriceRial : undefined,
    locationLabel: optionalText(raw.locationLabel),
    binId: optionalText(raw.binId),
    zone: optionalText(raw.zone),
  }
}

function mapReceipt(raw: ApiReceipt): InvoiceReceipt {
  const header = mapHeader(raw.header)
  const lines = (raw.lines ?? []).map(mapLine)
  const totals = computeReceiptTotals(lines, header.discountRial, header.vatRial)
  const createdBatchIds = raw.createdBatchIds?.filter(Boolean)
  return {
    id: raw.id ?? '',
    status: receiptStatus(raw.status),
    currentStep: currentStep(raw.currentStep),
    header,
    lines,
    createdBatchIds: createdBatchIds?.length ? createdBatchIds : undefined,
    createdBy: {
      userId: raw.createdBy?.userId ?? '',
      name: raw.createdBy?.name ?? '',
      role: raw.createdBy?.role ?? '',
    },
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    confirmedAt: optionalText(raw.confirmedAt),
    grossRial: typeof raw.grossRial === 'number' ? raw.grossRial : totals.grossRial,
    netRial: typeof raw.netRial === 'number' ? raw.netRial : totals.netRial,
  }
}

export async function createReceipt(header: ReceiptHeader): Promise<InvoiceReceipt> {
  const res = await apiRequest<ApiReceipt>('/api/v1/receipts', {
    method: 'POST',
    auth: true,
    body: header,
  })
  return mapReceipt(res)
}

export async function getReceipt(id: string): Promise<InvoiceReceipt> {
  const res = await apiRequest<ApiReceipt>(`/api/v1/receipts/${id}`, {
    auth: true,
  })
  return mapReceipt(res)
}

export async function listReceipts(
  params: ListReceiptsQuery = {},
): Promise<ListReceiptsResult> {
  const res = await apiRequest<ListEnvelope>('/api/v1/receipts', {
    auth: true,
    query: {
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    },
  })
  return {
    items: (res.items ?? []).map(mapReceipt),
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    pageSize: res.pageSize ?? params.pageSize ?? 25,
    pageCount: res.pageCount ?? 0,
  }
}

export async function patchReceipt(
  id: string,
  body: ReceiptHeaderPatch,
): Promise<InvoiceReceipt> {
  const res = await apiRequest<ApiReceipt>(`/api/v1/receipts/${id}`, {
    method: 'PATCH',
    auth: true,
    body,
  })
  return mapReceipt(res)
}

export async function addReceiptLine(
  id: string,
  line: ReceiptLineInput,
): Promise<InvoiceReceipt> {
  const res = await apiRequest<ApiReceipt>(`/api/v1/receipts/${id}/lines`, {
    method: 'POST',
    auth: true,
    body: line,
  })
  return mapReceipt(res)
}

export async function patchReceiptLine(
  id: string,
  lineId: string,
  patch: ReceiptLinePatch,
): Promise<InvoiceReceipt> {
  const res = await apiRequest<ApiReceipt>(`/api/v1/receipts/${id}/lines/${lineId}`, {
    method: 'PATCH',
    auth: true,
    body: patch,
  })
  return mapReceipt(res)
}

export async function deleteReceiptLine(
  id: string,
  lineId: string,
): Promise<InvoiceReceipt> {
  const res = await apiRequest<ApiReceipt>(`/api/v1/receipts/${id}/lines/${lineId}`, {
    method: 'DELETE',
    auth: true,
  })
  return mapReceipt(res)
}

export async function confirmReceipt(id: string): Promise<InvoiceReceipt> {
  const res = await apiRequest<ApiReceipt>(`/api/v1/receipts/${id}/confirm`, {
    method: 'POST',
    auth: true,
  })
  return mapReceipt(res)
}
