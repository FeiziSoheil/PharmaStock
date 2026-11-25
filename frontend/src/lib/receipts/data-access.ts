import {
  addReceiptLine as apiAddReceiptLine,
  confirmReceipt as apiConfirmReceipt,
  createReceipt as apiCreateReceipt,
  deleteReceiptLine as apiDeleteReceiptLine,
  getReceipt as apiGetReceipt,
  listReceipts as apiListReceipts,
  patchReceipt as apiPatchReceipt,
  patchReceiptLine as apiPatchReceiptLine,
  type ListReceiptsQuery,
  type ListReceiptsResult,
  type ReceiptHeaderPatch,
  type ReceiptLineInput,
  type ReceiptLinePatch,
} from '@/lib/api/receipts'
import type { InvoiceReceipt, ReceiptHeader } from '@/lib/types/receipts'

export type {
  ListReceiptsQuery,
  ListReceiptsResult,
  ReceiptHeaderPatch,
  ReceiptLineInput,
  ReceiptLinePatch,
}

export async function createReceipt(header: ReceiptHeader): Promise<InvoiceReceipt> {
  return apiCreateReceipt(header)
}

export async function getReceipt(id: string): Promise<InvoiceReceipt> {
  return apiGetReceipt(id)
}

export async function listReceipts(
  params: ListReceiptsQuery = {},
): Promise<ListReceiptsResult> {
  return apiListReceipts(params)
}

export async function patchReceipt(
  id: string,
  body: ReceiptHeaderPatch,
): Promise<InvoiceReceipt> {
  return apiPatchReceipt(id, body)
}

export async function addReceiptLine(
  id: string,
  line: ReceiptLineInput,
): Promise<InvoiceReceipt> {
  return apiAddReceiptLine(id, line)
}

export async function patchReceiptLine(
  id: string,
  lineId: string,
  patch: ReceiptLinePatch,
): Promise<InvoiceReceipt> {
  return apiPatchReceiptLine(id, lineId, patch)
}

export async function deleteReceiptLine(
  id: string,
  lineId: string,
): Promise<InvoiceReceipt> {
  return apiDeleteReceiptLine(id, lineId)
}

export async function confirmReceipt(id: string): Promise<InvoiceReceipt> {
  return apiConfirmReceipt(id)
}
