import {
  addDispenseLine as apiAddDispenseLine,
  clearDispenseLines as apiClearDispenseLines,
  confirmDispense as apiConfirmDispense,
  createDispense as apiCreateDispense,
  deleteDispenseLine as apiDeleteDispenseLine,
  fefoPreview as apiFefoPreview,
  getDispense as apiGetDispense,
  listDispenses as apiListDispenses,
  patchDispense as apiPatchDispense,
  patchDispenseLine as apiPatchDispenseLine,
  type DispenseCreateInput,
  type DispenseLineInput,
  type DispenseLinePatch,
  type DispensePatch,
  type FefoPreview,
  type ListDispensesQuery,
  type ListDispensesResult,
} from '@/lib/api/dispenses'
import type { DispenseOrder } from '@/lib/types/dispenses'

export type {
  DispenseCreateInput,
  DispenseLineInput,
  DispenseLinePatch,
  DispensePatch,
  FefoPreview,
  ListDispensesQuery,
  ListDispensesResult,
}

export async function createDispense(
  body: DispenseCreateInput = {},
): Promise<DispenseOrder> {
  return apiCreateDispense(body)
}

export async function getDispense(id: string): Promise<DispenseOrder> {
  return apiGetDispense(id)
}

export async function listDispenses(
  params: ListDispensesQuery = {},
): Promise<ListDispensesResult> {
  return apiListDispenses(params)
}

export async function patchDispense(id: string, body: DispensePatch): Promise<DispenseOrder> {
  return apiPatchDispense(id, body)
}

export async function addDispenseLine(
  id: string,
  line: DispenseLineInput,
): Promise<DispenseOrder> {
  return apiAddDispenseLine(id, line)
}

export async function patchDispenseLine(
  id: string,
  lineId: string,
  patch: DispenseLinePatch,
): Promise<DispenseOrder> {
  return apiPatchDispenseLine(id, lineId, patch)
}

export async function deleteDispenseLine(id: string, lineId: string): Promise<DispenseOrder> {
  return apiDeleteDispenseLine(id, lineId)
}

export async function clearDispenseLines(id: string): Promise<DispenseOrder> {
  return apiClearDispenseLines(id)
}

export async function confirmDispense(id: string): Promise<DispenseOrder> {
  return apiConfirmDispense(id)
}

export async function fefoPreview(drugId: string): Promise<FefoPreview> {
  return apiFefoPreview(drugId)
}
