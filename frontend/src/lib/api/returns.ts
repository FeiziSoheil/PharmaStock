import type {
  CreateDistributorReturnInput,
  DistributorEligibilityResult,
  DistributorReturn,
  DistributorReturnGroup,
  DistributorReturnLine,
  EligibleReturnBatch,
  ReturnSlipStatus,
  ReturnUrgency,
  SettleDistributorReturnInput,
} from '@/lib/types/returns'
import { apiRequest } from './http'

const SLIP_STATUSES: readonly ReturnSlipStatus[] = [
  'draft',
  'confirmed',
  'settled',
  'cancelled',
]

const URGENCIES: readonly ReturnUrgency[] = [
  'expired',
  'urgent',
  'golden',
  'watch',
]

type ApiEligibleBatch = {
  batchId?: string
  drugId?: string
  nameFa?: string
  dosageForm?: string
  strength?: string
  manufacturer?: string
  irc?: string
  batchNo?: string
  expiry?: string
  daysUntilExpiry?: number
  quantity?: number
  unitLabel?: string
  buyPriceRial?: number
  totalValueRial?: number
  status?: string
  locationLabel?: string
  distributorId?: string
  distributorName?: string
  contractReason?: string
  urgency?: string
  isControlled?: boolean
}

type ApiGroup = {
  distributorId?: string
  distributorName?: string
  distributorCode?: string
  customerCode?: string
  visitorName?: string
  depositLocation?: string
  batchCount?: number
  totalQty?: number
  totalValueRial?: number
  nearestDays?: number
  nearestExpiry?: string
  items?: ApiEligibleBatch[] | null
}

type ApiEligibilityResponse = {
  windowDays?: number
  todayISO?: string
  kpis?: {
    totalBatches?: number
    urgentBatches?: number
    totalValueRial?: number
    activeDistributors?: number
    distributorNames?: string[] | null
    pendingVisitorSlips?: number
  }
  groups?: ApiGroup[] | null
}

type ApiReturnLine = {
  id?: string
  batchId?: string
  drugId?: string
  nameFa?: string
  dosageForm?: string
  strength?: string
  manufacturer?: string
  irc?: string
  batchNo?: string
  expiry?: string
  quantity?: number
  availableQty?: number
  unitLabel?: string
  buyPriceRial?: number
  lineTotalRial?: number
  locationLabel?: string
  reason?: string
  isControlled?: boolean
}

type ApiDistributorReturn = {
  id?: string
  returnNo?: string
  status?: string
  distributorId?: string
  distributorName?: string
  distributorCode?: string
  customerCode?: string
  visitorName?: string
  creditNoteNo?: string
  windowDays?: number
  note?: string
  lines?: ApiReturnLine[] | null
  totalQty?: number
  totalValueRial?: number
  createdBy?: { userId?: string; name?: string; role?: string }
  createdAt?: string
  updatedAt?: string
  confirmedAt?: string
  settledAt?: string
}

type ListEnvelope = {
  items?: ApiDistributorReturn[] | null
  total?: number
  page?: number
  pageSize?: number
  pageCount?: number
}

export type GetEligibleReturnsQuery = {
  windowDays?: number
  search?: string
  distributorId?: string
}

export type ListReturnsQuery = {
  status?: ReturnSlipStatus
  distributorId?: string
  page?: number
  pageSize?: number
}

export type ListReturnsResult = {
  items: DistributorReturn[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

function normalizeUrgency(val: string | undefined): ReturnUrgency {
  if (val && (URGENCIES as readonly string[]).includes(val)) {
    return val as ReturnUrgency
  }
  return 'watch'
}

function normalizeSlipStatus(val: string | undefined): ReturnSlipStatus {
  if (val && (SLIP_STATUSES as readonly string[]).includes(val)) {
    return val as ReturnSlipStatus
  }
  return 'draft'
}

function mapEligibleBatch(raw: ApiEligibleBatch): EligibleReturnBatch {
  return {
    batchId: raw.batchId ?? '',
    drugId: raw.drugId ?? '',
    nameFa: raw.nameFa ?? '',
    dosageForm: raw.dosageForm ?? '',
    strength: raw.strength ?? '',
    manufacturer: raw.manufacturer ?? '',
    irc: raw.irc ?? '',
    batchNo: raw.batchNo ?? '',
    expiry: raw.expiry ?? '',
    daysUntilExpiry: raw.daysUntilExpiry ?? 0,
    quantity: raw.quantity ?? 0,
    unitLabel: raw.unitLabel?.trim() || 'عدد',
    buyPriceRial: raw.buyPriceRial ?? 0,
    totalValueRial: raw.totalValueRial ?? 0,
    status: raw.status ?? 'active',
    locationLabel: raw.locationLabel ?? '',
    distributorId: raw.distributorId ?? '',
    distributorName: raw.distributorName ?? '',
    contractReason: raw.contractReason ?? '',
    urgency: normalizeUrgency(raw.urgency),
    isControlled: Boolean(raw.isControlled),
  }
}

function mapGroup(raw: ApiGroup): DistributorReturnGroup {
  return {
    distributorId: raw.distributorId ?? '',
    distributorName: raw.distributorName ?? '',
    distributorCode: raw.distributorCode ?? '',
    customerCode: raw.customerCode ?? '',
    visitorName: raw.visitorName ?? '',
    depositLocation: raw.depositLocation ?? '',
    batchCount: raw.batchCount ?? 0,
    totalQty: raw.totalQty ?? 0,
    totalValueRial: raw.totalValueRial ?? 0,
    nearestDays: raw.nearestDays ?? 0,
    nearestExpiry: raw.nearestExpiry ?? '',
    items: (raw.items ?? []).map(mapEligibleBatch),
  }
}

function mapReturnLine(raw: ApiReturnLine): DistributorReturnLine {
  return {
    id: raw.id ?? '',
    batchId: raw.batchId ?? '',
    drugId: raw.drugId ?? '',
    nameFa: raw.nameFa ?? '',
    dosageForm: raw.dosageForm,
    strength: raw.strength,
    manufacturer: raw.manufacturer,
    irc: raw.irc,
    batchNo: raw.batchNo ?? '',
    expiry: raw.expiry ?? '',
    quantity: raw.quantity ?? 0,
    availableQty: raw.availableQty ?? 0,
    unitLabel: raw.unitLabel?.trim() || 'عدد',
    buyPriceRial: raw.buyPriceRial ?? 0,
    lineTotalRial: raw.lineTotalRial ?? 0,
    locationLabel: raw.locationLabel,
    reason: raw.reason ?? '',
    isControlled: Boolean(raw.isControlled),
  }
}

function mapReturn(raw: ApiDistributorReturn): DistributorReturn {
  return {
    id: raw.id ?? '',
    returnNo: raw.returnNo || undefined,
    status: normalizeSlipStatus(raw.status),
    distributorId: raw.distributorId ?? '',
    distributorName: raw.distributorName ?? '',
    distributorCode: raw.distributorCode,
    customerCode: raw.customerCode,
    visitorName: raw.visitorName,
    creditNoteNo: raw.creditNoteNo,
    windowDays: raw.windowDays ?? 90,
    note: raw.note,
    lines: (raw.lines ?? []).map(mapReturnLine),
    totalQty: raw.totalQty ?? 0,
    totalValueRial: raw.totalValueRial ?? 0,
    createdBy: {
      userId: raw.createdBy?.userId ?? '',
      name: raw.createdBy?.name ?? '',
      role: raw.createdBy?.role ?? '',
    },
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
    confirmedAt: raw.confirmedAt || undefined,
    settledAt: raw.settledAt || undefined,
  }
}

export async function getEligibleReturns(
  params: GetEligibleReturnsQuery = {},
): Promise<DistributorEligibilityResult> {
  const res = await apiRequest<ApiEligibilityResponse>(
    '/api/v1/returns/eligible',
    {
      auth: true,
      query: {
        windowDays: params.windowDays,
        search: params.search?.trim() || undefined,
        distributorId: params.distributorId || undefined,
      },
    },
  )

  return {
    windowDays: res.windowDays ?? params.windowDays ?? 90,
    todayISO: res.todayISO ?? '',
    kpis: {
      totalBatches: res.kpis?.totalBatches ?? 0,
      urgentBatches: res.kpis?.urgentBatches ?? 0,
      totalValueRial: res.kpis?.totalValueRial ?? 0,
      activeDistributors: res.kpis?.activeDistributors ?? 0,
      distributorNames: res.kpis?.distributorNames ?? [],
      pendingVisitorSlips: res.kpis?.pendingVisitorSlips ?? 0,
    },
    groups: (res.groups ?? []).map(mapGroup),
  }
}

export async function listReturns(
  params: ListReturnsQuery = {},
): Promise<ListReturnsResult> {
  const res = await apiRequest<ListEnvelope>('/api/v1/returns', {
    auth: true,
    query: {
      status: params.status,
      distributorId: params.distributorId,
      page: params.page,
      pageSize: params.pageSize,
    },
  })

  return {
    items: (res.items ?? []).map(mapReturn),
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    pageSize: res.pageSize ?? params.pageSize ?? 25,
    pageCount: res.pageCount ?? 0,
  }
}

export async function getReturn(id: string): Promise<DistributorReturn> {
  const res = await apiRequest<ApiDistributorReturn>(`/api/v1/returns/${id}`, {
    auth: true,
  })
  return mapReturn(res)
}

export async function createReturn(
  body: CreateDistributorReturnInput,
): Promise<DistributorReturn> {
  const res = await apiRequest<ApiDistributorReturn>('/api/v1/returns', {
    method: 'POST',
    auth: true,
    body,
  })
  return mapReturn(res)
}

export async function confirmReturn(id: string): Promise<DistributorReturn> {
  const res = await apiRequest<ApiDistributorReturn>(
    `/api/v1/returns/${id}/confirm`,
    {
      method: 'POST',
      auth: true,
    },
  )
  return mapReturn(res)
}

export async function settleReturn(
  id: string,
  body: SettleDistributorReturnInput = {},
): Promise<DistributorReturn> {
  const res = await apiRequest<ApiDistributorReturn>(
    `/api/v1/returns/${id}/settle`,
    {
      method: 'POST',
      auth: true,
      body,
    },
  )
  return mapReturn(res)
}
