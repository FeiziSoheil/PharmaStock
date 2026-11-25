import type {
  DispenseAllocation,
  DispenseControlled,
  DispenseFees,
  DispenseLine,
  DispenseOrder,
  DispensePatient,
  DispenseStatus,
} from '@/lib/types/dispenses'
import { computeDispenseTotals } from '@/lib/dispenses/gating'
import { apiRequest } from './http'

const STATUSES: readonly DispenseStatus[] = ['draft', 'confirmed', 'cancelled']
const ALLOCATIONS: readonly DispenseAllocation[] = ['fefo', 'manual']

type ApiPatient = {
  nameFa?: string
  nationalId?: string
  insuranceLabel?: string
  rxTrackingId?: string
}

type ApiControlled = {
  physicianName?: string
  physicianLicense?: string
  recipientNationalId?: string
  eRxTrackingId?: string
  technicalAck?: boolean
}

type ApiLine = {
  id?: string
  drugId?: string
  nameFa?: string
  nameEn?: string
  irc?: string
  manufacturer?: string
  unitLabel?: string
  quantity?: number
  consumerPrice?: number
  batchId?: string
  batchNo?: string
  expiry?: string
  locationLabel?: string
  binId?: string
  allocation?: string
  manualReason?: string
  isColdChain?: boolean
  isControlled?: boolean
  controlled?: ApiControlled | null
}

type ApiFees = {
  technicalFee?: number
  insuranceCover?: number
}

type ApiDispense = {
  id?: string
  status?: string
  orderNo?: string
  patient?: ApiPatient
  lines?: ApiLine[] | null
  fees?: ApiFees
  createdBy?: { userId?: string; name?: string; role?: string }
  createdAt?: string
  updatedAt?: string
  confirmedAt?: string
  goodsTotal?: number
  patientPayable?: number
  lineCount?: number
  coldCount?: number
  controlledCount?: number
}

type ApiFefo = {
  batchId?: string
  drugId?: string
  binId?: string
  nameFa?: string
  nameEn?: string
  batchNo?: string
  expiry?: string
  quantity?: number
  status?: string
  unitLabel?: string
  manufacturer?: string
  isControlled?: boolean
  zone?: string
  locationLabel?: string
  consumerPrice?: number
  consumerPriceRial?: number
}

type ListEnvelope = {
  items?: ApiDispense[] | null
  total?: number
  page?: number
  pageSize?: number
  pageCount?: number
}

export type ListDispensesQuery = {
  status?: DispenseStatus
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export type ListDispensesResult = {
  items: DispenseOrder[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

/** Draft open body. Patient and fees are optional; the server applies defaults. */
export type DispenseCreateInput = {
  patient?: Partial<DispensePatient>
  fees?: Partial<DispenseFees>
}

/** Partial draft update. Omitted patient/fee fields stay unchanged on the server. */
export type DispensePatch = {
  patient?: Partial<DispensePatient>
  fees?: Partial<DispenseFees>
}

/** New line body. FEFO batch is chosen on the server from `drugId`, `barcode`, or `gtin`. */
export type DispenseLineInput = {
  drugId?: string
  barcode?: string
  gtin?: string
  quantity?: number
}

/** Partial line edit. Omitted fields stay unchanged on the server. */
export type DispenseLinePatch = {
  quantity?: number
  batchId?: string
  manualReason?: string
  controlled?: DispenseControlled
}

/** FEFO candidate for the manual batch picker. `consumerPrice` mirrors the line field. */
export type FefoPreview = {
  batchId: string
  drugId: string
  binId: string
  nameFa: string
  nameEn?: string
  batchNo: string
  expiry: string
  quantity: number
  status: string
  unitLabel: string
  manufacturer?: string
  isControlled: boolean
  zone?: string
  locationLabel: string
  consumerPrice: number
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function dispenseStatus(value: string | undefined): DispenseStatus {
  if (value && (STATUSES as readonly string[]).includes(value)) {
    return value as DispenseStatus
  }
  return 'draft'
}

function allocation(value: string | undefined): DispenseAllocation {
  if (value && (ALLOCATIONS as readonly string[]).includes(value)) {
    return value as DispenseAllocation
  }
  return 'fefo'
}

function mapPatient(raw: ApiPatient | undefined): DispensePatient {
  return {
    nameFa: raw?.nameFa ?? '',
    nationalId: optionalText(raw?.nationalId),
    insuranceLabel: optionalText(raw?.insuranceLabel),
    rxTrackingId: optionalText(raw?.rxTrackingId),
  }
}

function mapFees(raw: ApiFees | undefined): DispenseFees {
  return {
    technicalFee: raw?.technicalFee ?? 0,
    insuranceCover: raw?.insuranceCover ?? 0,
  }
}

function mapControlled(raw: ApiControlled): DispenseControlled {
  return {
    physicianName: raw.physicianName ?? '',
    physicianLicense: optionalText(raw.physicianLicense),
    recipientNationalId: raw.recipientNationalId ?? '',
    eRxTrackingId: raw.eRxTrackingId ?? '',
    technicalAck: raw.technicalAck === true,
  }
}

function mapLine(raw: ApiLine): DispenseLine {
  return {
    id: raw.id ?? '',
    drugId: raw.drugId ?? '',
    nameFa: raw.nameFa ?? '',
    nameEn: optionalText(raw.nameEn),
    irc: optionalText(raw.irc),
    manufacturer: optionalText(raw.manufacturer),
    unitLabel: raw.unitLabel?.trim() || 'عدد',
    quantity: raw.quantity ?? 0,
    consumerPrice: typeof raw.consumerPrice === 'number' ? raw.consumerPrice : 0,
    batchId: raw.batchId ?? '',
    batchNo: raw.batchNo ?? '',
    expiry: raw.expiry ?? '',
    locationLabel: raw.locationLabel?.trim() ?? '',
    binId: optionalText(raw.binId),
    allocation: allocation(raw.allocation),
    manualReason: optionalText(raw.manualReason),
    isColdChain: raw.isColdChain === true,
    isControlled: raw.isControlled === true,
    controlled: raw.controlled ? mapControlled(raw.controlled) : undefined,
  }
}

function mapDispense(raw: ApiDispense): DispenseOrder {
  const lines = (raw.lines ?? []).map(mapLine)
  const fees = mapFees(raw.fees)
  const totals = computeDispenseTotals({ lines, fees })
  return {
    id: raw.id ?? '',
    status: dispenseStatus(raw.status),
    orderNo: optionalText(raw.orderNo),
    patient: mapPatient(raw.patient),
    lines,
    fees,
    createdBy: {
      userId: raw.createdBy?.userId ?? '',
      name: raw.createdBy?.name ?? '',
      role: raw.createdBy?.role ?? '',
    },
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    confirmedAt: optionalText(raw.confirmedAt),
    goodsTotal: typeof raw.goodsTotal === 'number' ? raw.goodsTotal : totals.goodsTotal,
    patientPayable:
      typeof raw.patientPayable === 'number' ? raw.patientPayable : totals.patientPayable,
    lineCount: typeof raw.lineCount === 'number' ? raw.lineCount : totals.lineCount,
    coldCount: typeof raw.coldCount === 'number' ? raw.coldCount : totals.coldCount,
    controlledCount:
      typeof raw.controlledCount === 'number' ? raw.controlledCount : totals.controlledCount,
  }
}

function mapFefo(raw: ApiFefo): FefoPreview {
  const consumerPrice =
    typeof raw.consumerPrice === 'number'
      ? raw.consumerPrice
      : typeof raw.consumerPriceRial === 'number'
        ? raw.consumerPriceRial
        : 0
  return {
    batchId: raw.batchId ?? '',
    drugId: raw.drugId ?? '',
    binId: raw.binId ?? '',
    nameFa: raw.nameFa ?? '',
    nameEn: optionalText(raw.nameEn),
    batchNo: raw.batchNo ?? '',
    expiry: raw.expiry ?? '',
    quantity: raw.quantity ?? 0,
    status: raw.status ?? '',
    unitLabel: raw.unitLabel?.trim() || 'عدد',
    manufacturer: optionalText(raw.manufacturer),
    isControlled: raw.isControlled === true,
    zone: optionalText(raw.zone),
    locationLabel: raw.locationLabel?.trim() ?? '',
    consumerPrice,
  }
}

export async function createDispense(
  body: DispenseCreateInput = {},
): Promise<DispenseOrder> {
  const res = await apiRequest<ApiDispense>('/api/v1/dispenses', {
    method: 'POST',
    auth: true,
    body,
  })
  return mapDispense(res)
}

export async function getDispense(id: string): Promise<DispenseOrder> {
  const res = await apiRequest<ApiDispense>(`/api/v1/dispenses/${id}`, {
    auth: true,
  })
  return mapDispense(res)
}

export async function listDispenses(
  params: ListDispensesQuery = {},
): Promise<ListDispensesResult> {
  const res = await apiRequest<ListEnvelope>('/api/v1/dispenses', {
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
    items: (res.items ?? []).map(mapDispense),
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    pageSize: res.pageSize ?? params.pageSize ?? 25,
    pageCount: res.pageCount ?? 0,
  }
}

export async function patchDispense(id: string, body: DispensePatch): Promise<DispenseOrder> {
  const res = await apiRequest<ApiDispense>(`/api/v1/dispenses/${id}`, {
    method: 'PATCH',
    auth: true,
    body,
  })
  return mapDispense(res)
}

export async function addDispenseLine(
  id: string,
  line: DispenseLineInput,
): Promise<DispenseOrder> {
  const res = await apiRequest<ApiDispense>(`/api/v1/dispenses/${id}/lines`, {
    method: 'POST',
    auth: true,
    body: line,
  })
  return mapDispense(res)
}

export async function patchDispenseLine(
  id: string,
  lineId: string,
  patch: DispenseLinePatch,
): Promise<DispenseOrder> {
  const res = await apiRequest<ApiDispense>(`/api/v1/dispenses/${id}/lines/${lineId}`, {
    method: 'PATCH',
    auth: true,
    body: patch,
  })
  return mapDispense(res)
}

export async function deleteDispenseLine(id: string, lineId: string): Promise<DispenseOrder> {
  const res = await apiRequest<ApiDispense>(`/api/v1/dispenses/${id}/lines/${lineId}`, {
    method: 'DELETE',
    auth: true,
  })
  return mapDispense(res)
}

export async function clearDispenseLines(id: string): Promise<DispenseOrder> {
  const res = await apiRequest<ApiDispense>(`/api/v1/dispenses/${id}/clear-lines`, {
    method: 'POST',
    auth: true,
  })
  return mapDispense(res)
}

export async function confirmDispense(id: string): Promise<DispenseOrder> {
  const res = await apiRequest<ApiDispense>(`/api/v1/dispenses/${id}/confirm`, {
    method: 'POST',
    auth: true,
  })
  return mapDispense(res)
}

export async function fefoPreview(drugId: string): Promise<FefoPreview> {
  const res = await apiRequest<ApiFefo>('/api/v1/dispenses/fefo-preview', {
    auth: true,
    query: { drugId },
  })
  return mapFefo(res)
}
