import type {
  InternalTransfer,
  MatchStatus,
  TransferHeader,
  TransferLine,
  TransferReason,
  TransferStatus,
} from '@/lib/types/transfers'
import { apiRequest } from './http'

const STATUSES: readonly TransferStatus[] = ['draft', 'confirmed', 'cancelled']
const REASONS: readonly TransferReason[] = [
  'routine_front',
  'urgent_rx',
  'night_cap',
  'fefo_move',
]
const MATCH_STATUSES: readonly MatchStatus[] = ['barcode', 'physical']

type ApiHeader = {
  reason?: string
  sourceZone?: string
  destZone?: string
  sourceLabel?: string
  destLabel?: string
  note?: string
  receiverName?: string
}

type ApiLine = {
  id?: string
  drugId?: string
  nameFa?: string
  batchNo?: string
  expiry?: string
  sourceBatchId?: string
  sourceBinId?: string
  sourceLocationLabel?: string
  destBinId?: string
  destLocationLabel?: string
  quantity?: number
  unitLabel?: string
  matchStatus?: string
}

type ApiTransfer = {
  id?: string
  status?: string
  currentStep?: number
  header?: ApiHeader
  lines?: ApiLine[] | null
  transferNo?: string
  resultBatchIds?: string[]
  createdBy?: { userId?: string; name?: string; role?: string }
  createdAt?: string
  updatedAt?: string
  confirmedAt?: string
}

type ListEnvelope = {
  items?: ApiTransfer[] | null
  total?: number
  page?: number
  pageSize?: number
  pageCount?: number
}

export type ListTransfersQuery = {
  status?: TransferStatus
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export type ListTransfersResult = {
  items: InternalTransfer[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

/** Partial draft header. Omitted fields stay unchanged on the server. */
export type TransferHeaderPatch = {
  reason?: TransferReason
  sourceZone?: string
  destZone?: string
  sourceLabel?: string
  destLabel?: string
  note?: string
  receiverName?: string
  currentStep?: 1 | 2
}

export type TransferLineInput = {
  sourceBatchId: string
  quantity: number
  destBinId?: string
  destLocationLabel?: string
  matchStatus?: MatchStatus
}

export type TransferLinePatch = {
  quantity?: number
  destBinId?: string
  destLocationLabel?: string
  matchStatus?: MatchStatus
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function transferStatus(value: string | undefined): TransferStatus {
  if (value && (STATUSES as readonly string[]).includes(value)) {
    return value as TransferStatus
  }
  return 'draft'
}

function transferReason(value: string | undefined): TransferReason {
  if (value && (REASONS as readonly string[]).includes(value)) {
    return value as TransferReason
  }
  return 'routine_front'
}

function matchStatus(value: string | undefined): MatchStatus {
  if (value && (MATCH_STATUSES as readonly string[]).includes(value)) {
    return value as MatchStatus
  }
  return 'barcode'
}

function currentStep(value: number | undefined): 1 | 2 {
  if (value === 2) return 2
  return 1
}

function mapHeader(raw: ApiHeader | undefined): TransferHeader {
  return {
    reason: transferReason(raw?.reason),
    sourceZone: raw?.sourceZone ?? '',
    destZone: raw?.destZone ?? '',
    sourceLabel: raw?.sourceLabel ?? '',
    destLabel: raw?.destLabel ?? '',
    note: optionalText(raw?.note),
    receiverName: optionalText(raw?.receiverName),
  }
}

function mapLine(raw: ApiLine): TransferLine {
  return {
    id: raw.id ?? '',
    drugId: raw.drugId ?? '',
    nameFa: raw.nameFa ?? '',
    batchNo: raw.batchNo ?? '',
    expiry: raw.expiry ?? '',
    sourceBatchId: raw.sourceBatchId ?? '',
    sourceBinId: optionalText(raw.sourceBinId),
    sourceLocationLabel: raw.sourceLocationLabel ?? '',
    destBinId: optionalText(raw.destBinId),
    destLocationLabel: optionalText(raw.destLocationLabel),
    quantity: raw.quantity ?? 0,
    unitLabel: raw.unitLabel?.trim() || 'عدد',
    matchStatus: matchStatus(raw.matchStatus),
  }
}

function mapTransfer(raw: ApiTransfer): InternalTransfer {
  const resultBatchIds = raw.resultBatchIds?.filter(Boolean)
  return {
    id: raw.id ?? '',
    status: transferStatus(raw.status),
    currentStep: currentStep(raw.currentStep),
    header: mapHeader(raw.header),
    lines: (raw.lines ?? []).map(mapLine),
    transferNo: optionalText(raw.transferNo),
    resultBatchIds: resultBatchIds?.length ? resultBatchIds : undefined,
    createdBy: {
      userId: raw.createdBy?.userId ?? '',
      name: raw.createdBy?.name ?? '',
      role: raw.createdBy?.role ?? '',
    },
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    confirmedAt: optionalText(raw.confirmedAt),
  }
}

export async function createTransfer(header: TransferHeader): Promise<InternalTransfer> {
  const res = await apiRequest<ApiTransfer>('/api/v1/transfers', {
    method: 'POST',
    auth: true,
    body: header,
  })
  return mapTransfer(res)
}

export async function getTransfer(id: string): Promise<InternalTransfer> {
  const res = await apiRequest<ApiTransfer>(`/api/v1/transfers/${id}`, {
    auth: true,
  })
  return mapTransfer(res)
}

export async function listTransfers(
  params: ListTransfersQuery = {},
): Promise<ListTransfersResult> {
  const res = await apiRequest<ListEnvelope>('/api/v1/transfers', {
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
    items: (res.items ?? []).map(mapTransfer),
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    pageSize: res.pageSize ?? params.pageSize ?? 25,
    pageCount: res.pageCount ?? 0,
  }
}

export async function patchTransfer(
  id: string,
  body: TransferHeaderPatch,
): Promise<InternalTransfer> {
  const res = await apiRequest<ApiTransfer>(`/api/v1/transfers/${id}`, {
    method: 'PATCH',
    auth: true,
    body,
  })
  return mapTransfer(res)
}

export async function addTransferLine(
  id: string,
  line: TransferLineInput,
): Promise<InternalTransfer> {
  const res = await apiRequest<ApiTransfer>(`/api/v1/transfers/${id}/lines`, {
    method: 'POST',
    auth: true,
    body: line,
  })
  return mapTransfer(res)
}

export async function patchTransferLine(
  id: string,
  lineId: string,
  patch: TransferLinePatch,
): Promise<InternalTransfer> {
  const res = await apiRequest<ApiTransfer>(`/api/v1/transfers/${id}/lines/${lineId}`, {
    method: 'PATCH',
    auth: true,
    body: patch,
  })
  return mapTransfer(res)
}

export async function deleteTransferLine(
  id: string,
  lineId: string,
): Promise<InternalTransfer> {
  const res = await apiRequest<ApiTransfer>(`/api/v1/transfers/${id}/lines/${lineId}`, {
    method: 'DELETE',
    auth: true,
  })
  return mapTransfer(res)
}

export async function clearTransferLines(id: string): Promise<InternalTransfer> {
  const res = await apiRequest<ApiTransfer>(`/api/v1/transfers/${id}/clear-lines`, {
    method: 'POST',
    auth: true,
  })
  return mapTransfer(res)
}

export async function confirmTransfer(id: string): Promise<InternalTransfer> {
  const res = await apiRequest<ApiTransfer>(`/api/v1/transfers/${id}/confirm`, {
    method: 'POST',
    auth: true,
  })
  return mapTransfer(res)
}
