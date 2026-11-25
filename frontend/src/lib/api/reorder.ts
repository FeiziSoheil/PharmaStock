import {
  DEFAULT_REORDER_FORMULA,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type ReorderFormulaConfig,
  type ReorderKpis,
} from '@/lib/types/reorder'
import type {
  ReorderQueryParams,
  ReorderSuggestion,
  ReorderRowStatus,
} from '@/lib/reorder/reorder-query'
import type { ReorderUrgency } from '@/lib/domain/reorder'
import { apiBaseUrl } from './config'
import { apiRequest, handleUnauthorized } from './http'
import { getToken } from './session'

type ApiSuggestion = {
  id: string
  drugId: string
  nameFa: string
  dosageForm: string
  strength: string
  irc: string
  distributorId: string
  distributorNameFa: string
  distributorNote?: string
  category: string
  isControlled: boolean
  availableStock: number
  reorderPoint: number
  targetStock: number
  onOrderQuantity: number
  avgDailyUsage: number
  packSize: number
  unitCost: number
  unitLabel: string
  leadTimeDays: number
  suggestedQty: number
  daysOfCover: number
  urgency: string
  locationHint?: string
  status: string
  storageTemp?: string
}

type ApiKpis = {
  belowRopCount: number
  zeroStockCount: number
  estimatedValue: number
  avgLeadTimeDays: number
  yesterdayDelta?: number
  byDistributor: { id: string; nameFa: string; count: number }[]
}

type ListEnvelope = {
  items: ApiSuggestion[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: ApiKpis
  formula?: Partial<ReorderFormulaConfig>
}

function mapFormula(raw?: Partial<ReorderFormulaConfig>): ReorderFormulaConfig {
  const buf = raw?.defaultBufferPct
  const defaultBufferPct: 0 | 10 | 20 =
    buf === 0 || buf === 10 || buf === 20 ? buf : DEFAULT_REORDER_FORMULA.defaultBufferPct
  return {
    mode:
      raw?.mode === 'dynamic_adu' || raw?.mode === 'drug_defaults'
        ? raw.mode
        : DEFAULT_REORDER_FORMULA.mode,
    safetyStockDays: raw?.safetyStockDays ?? DEFAULT_REORDER_FORMULA.safetyStockDays,
    targetCoverageDays: raw?.targetCoverageDays ?? DEFAULT_REORDER_FORMULA.targetCoverageDays,
    defaultBufferPct,
    includeOnOrder: raw?.includeOnOrder ?? DEFAULT_REORDER_FORMULA.includeOnOrder,
    roundToPackSize: raw?.roundToPackSize ?? DEFAULT_REORDER_FORMULA.roundToPackSize,
    criticalDays: raw?.criticalDays ?? DEFAULT_REORDER_FORMULA.criticalDays,
    lowDays: raw?.lowDays ?? DEFAULT_REORDER_FORMULA.lowDays,
    reorderDays: raw?.reorderDays ?? DEFAULT_REORDER_FORMULA.reorderDays,
  }
}

function mapSuggestion(raw: ApiSuggestion): ReorderSuggestion {
  const storage = raw.storageTemp
  const storageTemp: ReorderSuggestion['storageTemp'] =
    storage === 'room' ||
    storage === 'fridge' ||
    storage === 'freezer' ||
    storage === 'light'
      ? storage
      : undefined

  return {
    id: raw.id,
    drugId: raw.drugId,
    nameFa: raw.nameFa,
    dosageForm: raw.dosageForm,
    strength: raw.strength,
    irc: raw.irc,
    distributorId: raw.distributorId,
    distributorNameFa: raw.distributorNameFa,
    distributorNote: raw.distributorNote ?? '',
    category: raw.category,
    isControlled: Boolean(raw.isControlled),
    availableStock: raw.availableStock,
    reorderPoint: raw.reorderPoint,
    targetStock: raw.targetStock,
    onOrderQuantity: raw.onOrderQuantity,
    avgDailyUsage: raw.avgDailyUsage,
    packSize: raw.packSize,
    unitCost: raw.unitCost,
    unitLabel: raw.unitLabel,
    leadTimeDays: raw.leadTimeDays,
    suggestedQty: raw.suggestedQty,
    daysOfCover: raw.daysOfCover,
    urgency: (raw.urgency as ReorderUrgency) || 'reorder',
    locationHint: raw.locationHint ?? '',
    status: (raw.status as ReorderRowStatus) || 'active',
    storageTemp,
  }
}

function mapKpis(raw: ApiKpis): ReorderKpis {
  return {
    belowRopCount: raw.belowRopCount ?? 0,
    zeroStockCount: raw.zeroStockCount ?? 0,
    estimatedValue: raw.estimatedValue ?? 0,
    avgLeadTimeDays: raw.avgLeadTimeDays ?? 0,
    yesterdayDelta: raw.yesterdayDelta ?? 0,
    byDistributor: raw.byDistributor ?? [],
  }
}

export type ReorderListResult = {
  items: ReorderSuggestion[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: ReorderKpis
  formula: ReorderFormulaConfig
  allActive: ReorderSuggestion[]
}

export async function apiGetReorderSuggestions(
  params: ReorderQueryParams = {},
): Promise<ReorderListResult> {
  const query = {
    search: params.search,
    distributorId: params.distributorId || undefined,
    category: params.category || undefined,
    urgency: params.urgency || undefined,
    isControlled:
      params.isControlled === null || params.isControlled === undefined
        ? undefined
        : params.isControlled,
    activeOnly: params.activeOnly ?? true,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    page: params.page,
    pageSize: params.pageSize,
  }

  const [res, allRes] = await Promise.all([
    apiRequest<ListEnvelope>('/api/v1/reorder-suggestions', { query }),
    apiRequest<ListEnvelope>('/api/v1/reorder-suggestions', {
      query: {
        activeOnly: true,
        sortBy: 'daysOfCover',
        sortDir: 'asc',
        page: 1,
        pageSize: 50,
      },
    }),
  ])

  return {
    items: (res.items ?? []).map(mapSuggestion),
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
    pageCount: res.pageCount,
    kpis: mapKpis(res.kpis ?? {
      belowRopCount: 0,
      zeroStockCount: 0,
      estimatedValue: 0,
      avgLeadTimeDays: 0,
      byDistributor: [],
    }),
    formula: mapFormula(res.formula),
    allActive: (allRes.items ?? []).map(mapSuggestion),
  }
}

export async function apiGetReorderSettings(): Promise<ReorderFormulaConfig> {
  const raw = await apiRequest<Partial<ReorderFormulaConfig>>(
    '/api/v1/reorder-suggestions/settings',
  )
  return mapFormula(raw)
}

export async function apiUpdateReorderSettings(
  cfg: ReorderFormulaConfig,
): Promise<ReorderFormulaConfig> {
  const raw = await apiRequest<Partial<ReorderFormulaConfig>>(
    '/api/v1/reorder-suggestions/settings',
    {
      method: 'PUT',
      body: cfg,
    },
  )
  return mapFormula(raw)
}

export type DraftReorderItem = { id: string; finalQty: number }

export type DraftReorderResult = {
  draftId: string
  perDistributor: Record<string, number>
  orders?: PurchaseOrder[]
}

export type DraftReorderOptions = {
  mode?: 'draft' | 'submit'
  technicalConfirm?: boolean
  notes?: string
}

export async function apiDraftReorder(
  items: DraftReorderItem[],
  bufferPct: 0 | 10 | 20 = 0,
  options: DraftReorderOptions = {},
): Promise<DraftReorderResult> {
  return apiRequest<DraftReorderResult>('/api/v1/reorder-suggestions/draft', {
    method: 'POST',
    body: {
      items,
      bufferPct,
      mode: options.mode ?? 'draft',
      technicalConfirm: options.technicalConfirm ?? false,
      notes: options.notes ?? '',
    },
  })
}

export async function apiDismissReorder(ids: string[]): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/v1/reorder-suggestions/dismiss', {
    method: 'POST',
    body: { ids },
  })
}

export async function apiListPurchaseOrders(params: {
  status?: PurchaseOrderStatus | ''
  distributorId?: string
} = {}): Promise<{ items: PurchaseOrder[]; total: number }> {
  return apiRequest<{ items: PurchaseOrder[]; total: number }>(
    '/api/v1/purchase-orders',
    {
      query: {
        status: params.status || undefined,
        distributorId: params.distributorId || undefined,
      },
    },
  )
}

export async function apiUpdatePurchaseOrderStatus(
  id: string,
  body: {
    status: PurchaseOrderStatus
    technicalConfirm?: boolean
    notes?: string
  },
): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/api/v1/purchase-orders/${id}/status`, {
    method: 'PATCH',
    body,
  })
}

export type ExportProformaParams = {
  items?: DraftReorderItem[]
  bufferPct?: 0 | 10 | 20
  search?: string
  distributorId?: string
  category?: string
  urgency?: ReorderUrgency | ''
  isControlled?: boolean | null
}

async function fetchXlsxBlob(
  path: string,
  init: RequestInit,
  fallbackFilename: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = getToken()
  if (!token) {
    handleUnauthorized()
    throw new Error('نشست منقضی شده است.')
  }
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('نشست منقضی شده است.')
  }
  if (!res.ok) {
    let message = 'خطا در تولید فایل اکسل پیش‌فاکتور'
    try {
      const data = (await res.json()) as { error?: { message?: string } }
      if (data.error?.message) message = data.error.message
    } catch {
      // ignore non-json error bodies
    }
    throw new Error(message)
  }
  const disposition = res.headers.get('content-disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const blob = await res.blob()
  return {
    blob,
    filename: match?.[1] ?? fallbackFilename,
  }
}

export async function apiExportReorderProforma(
  params: ExportProformaParams = {},
): Promise<{ blob: Blob; filename: string }> {
  return fetchXlsxBlob(
    '/api/v1/reorder-suggestions/export',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: params.items ?? [],
        bufferPct: params.bufferPct ?? 0,
        search: params.search || undefined,
        distributorId: params.distributorId || undefined,
        category: params.category || undefined,
        urgency: params.urgency || undefined,
        isControlled:
          params.isControlled === null || params.isControlled === undefined
            ? undefined
            : params.isControlled,
      }),
    },
    'pharmastock-proforma.xlsx',
  )
}

export async function apiExportPurchaseOrder(
  id: string,
): Promise<{ blob: Blob; filename: string }> {
  return fetchXlsxBlob(
    `/api/v1/purchase-orders/${id}/export`,
    { method: 'GET' },
    `pharmastock-po-${id}.xlsx`,
  )
}
