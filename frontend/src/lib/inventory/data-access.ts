import { apiGetAllDrugs, apiLookupTtac } from '@/lib/api/drugs'
import { apiUpdateExpiryBatchStatus } from '@/lib/api/expiry'
import {
  apiBulkUpdateInventoryStatus,
  apiExportInventoryCsv,
  apiGetInventoryDashboard,
  apiStockInInventory,
} from '@/lib/api/inventory'
import { apiGetShelves } from '@/lib/api/shelves'
import { fetchAllPages } from '@/lib/api/paginate'
import type { ExpiryBatchStatus } from '@/lib/types/expiry'
import type { ShelfBin } from '@/lib/types/shelves'
import type {
  BulkStatusResult,
  InventoryDashboardQuery,
  InventoryDashboardResponse,
  StockInInput,
} from './types'

export async function fetchInventoryDashboard(
  query: InventoryDashboardQuery = {},
): Promise<InventoryDashboardResponse> {
  return apiGetInventoryDashboard(query)
}

export async function submitStockIn(body: StockInInput) {
  return apiStockInInventory(body)
}

export async function bulkUpdateInventoryStatus(
  batchIds: string[],
  status: ExpiryBatchStatus,
): Promise<BulkStatusResult> {
  return apiBulkUpdateInventoryStatus(batchIds, status)
}

export async function updateSingleBatchStatus(
  batchId: string,
  status: ExpiryBatchStatus,
) {
  return apiUpdateExpiryBatchStatus(batchId, status)
}

export async function downloadInventoryExcelCsv(
  query: InventoryDashboardQuery = {},
): Promise<void> {
  const blob = await apiExportInventoryCsv(query)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `pharmastock-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function fetchCatalogOptions() {
  return apiGetAllDrugs()
}

export async function fetchShelfBinOptions(): Promise<ShelfBin[]> {
  return fetchAllPages<ShelfBin>((page, pageSize) =>
    apiGetShelves({ page, pageSize }).then((res) => ({
      items: res.items,
      page: res.page,
      pageCount: res.pageCount,
    })),
  )
}

export { apiLookupTtac as lookupTtacForStockIn }
