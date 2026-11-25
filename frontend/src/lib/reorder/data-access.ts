import {
  apiDismissReorder,
  apiDraftReorder,
  apiExportPurchaseOrder,
  apiExportReorderProforma,
  apiGetReorderSettings,
  apiGetReorderSuggestions,
  apiListPurchaseOrders,
  apiUpdatePurchaseOrderStatus,
  apiUpdateReorderSettings,
  type DraftReorderItem,
  type DraftReorderOptions,
  type DraftReorderResult,
  type ExportProformaParams,
  type ReorderListResult,
} from '@/lib/api/reorder'
import type { ReorderQueryParams } from '@/lib/reorder/reorder-query'
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  ReorderFormulaConfig,
} from '@/lib/types/reorder'

export type { DraftReorderItem, DraftReorderOptions, DraftReorderResult }

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function fetchReorderSuggestions(
  params: ReorderQueryParams = {},
): Promise<ReorderListResult> {
  return apiGetReorderSuggestions(params)
}

export async function fetchReorderSettings(): Promise<ReorderFormulaConfig> {
  return apiGetReorderSettings()
}

export async function saveReorderSettings(
  cfg: ReorderFormulaConfig,
): Promise<ReorderFormulaConfig> {
  return apiUpdateReorderSettings(cfg)
}

export async function draftReorderSuggestions(
  items: DraftReorderItem[],
  bufferPct: 0 | 10 | 20 = 0,
  options: DraftReorderOptions = {},
): Promise<DraftReorderResult> {
  return apiDraftReorder(items, bufferPct, options)
}

export async function dismissReorderSuggestions(ids: string[]): Promise<void> {
  await apiDismissReorder(ids)
}

export async function exportReorderProformaExcel(
  params: ExportProformaParams = {},
): Promise<string> {
  const { blob, filename } = await apiExportReorderProforma(params)
  triggerBlobDownload(blob, filename)
  return filename
}

export async function fetchPurchaseOrders(params: {
  status?: PurchaseOrderStatus | ''
  distributorId?: string
} = {}): Promise<{ items: PurchaseOrder[]; total: number }> {
  return apiListPurchaseOrders(params)
}

export async function changePurchaseOrderStatus(
  id: string,
  body: {
    status: PurchaseOrderStatus
    technicalConfirm?: boolean
    notes?: string
  },
): Promise<PurchaseOrder> {
  return apiUpdatePurchaseOrderStatus(id, body)
}

export async function exportPurchaseOrderExcel(id: string): Promise<string> {
  const { blob, filename } = await apiExportPurchaseOrder(id)
  triggerBlobDownload(blob, filename)
  return filename
}
