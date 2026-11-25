import type { ExpiryBatch, ExpiryBatchStatus } from '@/lib/types/expiry'
import type { Drug } from '@/lib/types/drugs'
import { apiBaseUrl } from './config'
import { ApiError, apiRequest, handleUnauthorized } from './http'
import { getToken } from './session'
import type {
  BulkStatusResult,
  InventoryDashboardQuery,
  InventoryDashboardResponse,
  StockInInput,
} from '@/lib/inventory/types'

function buildInventoryQuery(params: InventoryDashboardQuery = {}) {
  return {
    search: params.search || undefined,
    category: params.category || undefined,
    stockStatus: params.stockStatus || undefined,
    storageTemp: params.storageTemp || undefined,
    sortBy: params.sortBy || undefined,
    sortDir: params.sortDir || undefined,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export async function apiGetInventoryDashboard(
  params: InventoryDashboardQuery = {},
): Promise<InventoryDashboardResponse> {
  return apiRequest<InventoryDashboardResponse>('/api/v1/inventory/dashboard', {
    query: buildInventoryQuery(params),
  })
}

export async function apiStockInInventory(
  body: StockInInput,
): Promise<{ drug: Drug; batch: ExpiryBatch; createdNewDrug: boolean }> {
  return apiRequest<{ drug: Drug; batch: ExpiryBatch; createdNewDrug: boolean }>(
    '/api/v1/inventory/stock-in',
    {
      method: 'POST',
      body,
    },
  )
}

export async function apiBulkUpdateInventoryStatus(
  batchIds: string[],
  status: ExpiryBatchStatus,
): Promise<BulkStatusResult> {
  return apiRequest<BulkStatusResult>('/api/v1/inventory/bulk-status', {
    method: 'POST',
    body: { batchIds, status },
  })
}

export async function apiExportInventoryCsv(
  params: InventoryDashboardQuery = {},
): Promise<Blob> {
  const token = getToken()
  if (!token) {
    handleUnauthorized()
    throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.', 'unauthorized')
  }

  const url = new URL(`${apiBaseUrl()}/api/v1/inventory/export`)
  for (const [key, value] of Object.entries(buildInventoryQuery(params))) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/csv',
    },
  })

  if (res.status === 401) {
    handleUnauthorized()
    throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.', 'unauthorized')
  }
  if (!res.ok) {
    throw new ApiError(res.status, 'خطا در دریافت خروجی اکسل موجودی انبار')
  }
  return res.blob()
}
