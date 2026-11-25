import {
  addTransferLine as apiAddTransferLine,
  clearTransferLines as apiClearTransferLines,
  confirmTransfer as apiConfirmTransfer,
  createTransfer as apiCreateTransfer,
  deleteTransferLine as apiDeleteTransferLine,
  getTransfer as apiGetTransfer,
  listTransfers as apiListTransfers,
  patchTransfer as apiPatchTransfer,
  patchTransferLine as apiPatchTransferLine,
  type ListTransfersQuery,
  type ListTransfersResult,
  type TransferHeaderPatch,
  type TransferLineInput,
  type TransferLinePatch,
} from '@/lib/api/transfers'
import type { InternalTransfer, TransferHeader } from '@/lib/types/transfers'

export type {
  ListTransfersQuery,
  ListTransfersResult,
  TransferHeaderPatch,
  TransferLineInput,
  TransferLinePatch,
}

export async function createTransfer(header: TransferHeader): Promise<InternalTransfer> {
  return apiCreateTransfer(header)
}

export async function getTransfer(id: string): Promise<InternalTransfer> {
  return apiGetTransfer(id)
}

export async function listTransfers(
  params: ListTransfersQuery = {},
): Promise<ListTransfersResult> {
  return apiListTransfers(params)
}

export async function patchTransfer(
  id: string,
  body: TransferHeaderPatch,
): Promise<InternalTransfer> {
  return apiPatchTransfer(id, body)
}

export async function addTransferLine(
  id: string,
  line: TransferLineInput,
): Promise<InternalTransfer> {
  return apiAddTransferLine(id, line)
}

export async function patchTransferLine(
  id: string,
  lineId: string,
  patch: TransferLinePatch,
): Promise<InternalTransfer> {
  return apiPatchTransferLine(id, lineId, patch)
}

export async function deleteTransferLine(
  id: string,
  lineId: string,
): Promise<InternalTransfer> {
  return apiDeleteTransferLine(id, lineId)
}

export async function clearTransferLines(id: string): Promise<InternalTransfer> {
  return apiClearTransferLines(id)
}

export async function confirmTransfer(id: string): Promise<InternalTransfer> {
  return apiConfirmTransfer(id)
}
