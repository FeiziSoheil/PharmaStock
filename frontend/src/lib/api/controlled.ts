import type {
  ControlledKpis,
  ControlledLedgerEntry,
  ControlledLedgerListResult,
  ControlledSource,
  ControlledTxType,
  ControlledWasteMode,
  CreateControlledEntryInput,
  VaultBinOption,
  VaultDrugStock,
} from '@/lib/types/controlled'
import { apiBaseUrl } from './config'
import { apiRequest, ApiError, handleUnauthorized } from './http'
import { getToken } from './session'

const TX_TYPES: readonly ControlledTxType[] = [
  'in_distributor',
  'out_prescription',
  'waste_return',
]

const SOURCES: readonly ControlledSource[] = [
  'ledger',
  'dispensing',
  'receipt',
  'seed',
]

type ApiEntry = {
  id?: string
  seqNo?: number
  timestamp?: string
  drugId?: string
  drugNameFa?: string
  dosageStrength?: string
  manufacturer?: string
  unitLabel?: string
  batchId?: string
  batchNo?: string
  expiry?: string
  txType?: string
  txSubLabel?: string
  wasteMode?: string
  qtyIn?: number
  qtyOut?: number
  ampouleWasteCount?: number
  balanceAfter?: number
  vaultBinAddress?: string
  physicianName?: string
  physicianLicense?: string
  patientNationalIdMasked?: string
  patientNote?: string
  trackingCode?: string
  sepasCode?: string
  technicalAck?: boolean
  signedBy?: { userId?: string; name?: string; role?: string; licenseNo?: string }
  source?: string
  refId?: string
}

type ApiListEnvelope = {
  items?: ApiEntry[] | null
  total?: number
  page?: number
  pageSize?: number
  pageCount?: number
  kpis?: Partial<ControlledKpis>
  vaultItems?: VaultDrugStock[] | null
  vaultBins?: VaultBinOption[] | null
}

export type ControlledLedgerQuery = {
  drugId?: string
  txType?: ControlledTxType | ''
  from?: string
  to?: string
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function resolveTxType(value: string | undefined): ControlledTxType {
  if (value && (TX_TYPES as readonly string[]).includes(value)) {
    return value as ControlledTxType
  }
  return 'out_prescription'
}

function resolveSource(value: string | undefined): ControlledSource {
  if (value && (SOURCES as readonly string[]).includes(value)) {
    return value as ControlledSource
  }
  return 'ledger'
}

function resolveWasteMode(value: string | undefined): ControlledWasteMode | undefined {
  if (value === 'used_ampoule' || value === 'damaged_stock') return value
  return undefined
}

function mapEntry(raw: ApiEntry): ControlledLedgerEntry {
  return {
    id: raw.id ?? '',
    seqNo: raw.seqNo ?? 0,
    timestamp: raw.timestamp ?? '',
    drugId: raw.drugId ?? '',
    drugNameFa: raw.drugNameFa ?? '',
    dosageStrength: optionalText(raw.dosageStrength),
    manufacturer: optionalText(raw.manufacturer),
    unitLabel: raw.unitLabel?.trim() || 'عدد',
    batchId: optionalText(raw.batchId),
    batchNo: raw.batchNo ?? '',
    expiry: optionalText(raw.expiry),
    txType: resolveTxType(raw.txType),
    txSubLabel: raw.txSubLabel ?? '',
    wasteMode: resolveWasteMode(raw.wasteMode),
    qtyIn: raw.qtyIn ?? 0,
    qtyOut: raw.qtyOut ?? 0,
    ampouleWasteCount: raw.ampouleWasteCount ?? 0,
    balanceAfter: raw.balanceAfter ?? 0,
    vaultBinAddress: optionalText(raw.vaultBinAddress),
    physicianName: optionalText(raw.physicianName),
    physicianLicense: optionalText(raw.physicianLicense),
    patientNationalIdMasked: optionalText(raw.patientNationalIdMasked),
    patientNote: optionalText(raw.patientNote),
    trackingCode: raw.trackingCode ?? '',
    sepasCode: optionalText(raw.sepasCode),
    technicalAck: raw.technicalAck === true,
    signedBy: {
      userId: raw.signedBy?.userId ?? '',
      name: raw.signedBy?.name ?? 'مسئول فنی',
      role: raw.signedBy?.role ?? 'technical_officer',
      licenseNo: optionalText(raw.signedBy?.licenseNo),
    },
    source: resolveSource(raw.source),
    refId: optionalText(raw.refId),
  }
}

export async function apiListControlledLedger(
  params: ControlledLedgerQuery = {},
): Promise<ControlledLedgerListResult> {
  const res = await apiRequest<ApiListEnvelope>('/api/v1/controlled-ledger', {
    auth: true,
    query: {
      drugId: params.drugId || undefined,
      txType: params.txType || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      search: params.search || undefined,
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    },
  })

  return {
    items: (res.items ?? []).map(mapEntry),
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    pageSize: res.pageSize ?? params.pageSize ?? 25,
    pageCount: res.pageCount ?? 0,
    kpis: {
      totalVaultBalance: res.kpis?.totalVaultBalance ?? 0,
      controlledDrugCount: res.kpis?.controlledDrugCount ?? 0,
      monthInflow: res.kpis?.monthInflow ?? 0,
      monthInflowShipments: res.kpis?.monthInflowShipments ?? 0,
      monthOutflow: res.kpis?.monthOutflow ?? 0,
      activePrescriptionCount: res.kpis?.activePrescriptionCount ?? 0,
      wasteDestroyedCount: res.kpis?.wasteDestroyedCount ?? 0,
      totalEntries: res.kpis?.totalEntries ?? 0,
      reconciliationPct: res.kpis?.reconciliationPct ?? 100,
      lastAuditAt: optionalText(res.kpis?.lastAuditAt),
    },
    vaultItems: res.vaultItems ?? [],
    vaultBins: res.vaultBins ?? [],
  }
}

export async function apiCreateControlledEntry(
  input: CreateControlledEntryInput,
): Promise<ControlledLedgerEntry> {
  const res = await apiRequest<ApiEntry>('/api/v1/controlled-ledger', {
    method: 'POST',
    auth: true,
    body: input,
  })
  return mapEntry(res)
}

export async function apiExportControlledLedger(
  params: ControlledLedgerQuery = {},
  format: 'csv' | 'json' = 'csv',
): Promise<Blob> {
  const url = new URL(`${apiBaseUrl()}/api/v1/controlled-ledger/export`)
  url.searchParams.set('format', format)
  const entries: Record<string, string | number | undefined> = {
    drugId: params.drugId || undefined,
    txType: params.txType || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    search: params.search || undefined,
    sortBy: params.sortBy,
    sortDir: params.sortDir ?? 'desc',
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const headers: Record<string, string> = { Accept: '*/*' }
  const token = getToken()
  if (!token) {
    handleUnauthorized()
    throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.', 'unauthorized')
  }
  headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(url.toString(), { headers })
  } catch {
    throw new ApiError(
      0,
      'خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.',
      'network_error',
    )
  }
  if (!response.ok) {
    if (response.status === 401) handleUnauthorized()
    throw new ApiError(
      response.status,
      response.status === 401
        ? 'نشست منقضی شده است. دوباره وارد شوید.'
        : 'خروجی دفترچه دریافت نشد.',
      response.status === 401 ? 'unauthorized' : undefined,
    )
  }
  return response.blob()
}
