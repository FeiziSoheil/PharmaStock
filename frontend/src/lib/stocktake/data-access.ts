import {
  confirmStocktake as apiConfirmStocktake,
  createStocktake as apiCreateStocktake,
  exportStocktakeCsv as apiExportStocktakeCsv,
  getStocktake as apiGetStocktake,
  listStocktakes as apiListStocktakes,
  recordStocktakeItem as apiRecordStocktakeItem,
  updateStocktake as apiUpdateStocktake,
  type ConfirmStocktakeBody,
  type CreateStocktakeBody,
  type ListStocktakesQuery,
  type ListStocktakesResult,
  type RecordStocktakeItemBody,
  type UpdateStocktakeBody,
} from '@/lib/api/stocktake'
import type { StocktakeCycle } from '@/lib/types/stocktake'

export type {
  ConfirmStocktakeBody,
  CreateStocktakeBody,
  ListStocktakesQuery,
  ListStocktakesResult,
  RecordStocktakeItemBody,
  UpdateStocktakeBody,
}

export async function listStocktakes(
  params: ListStocktakesQuery = {},
): Promise<ListStocktakesResult> {
  return apiListStocktakes(params)
}

export async function createStocktake(
  body: CreateStocktakeBody,
): Promise<StocktakeCycle> {
  return apiCreateStocktake(body)
}

export async function getStocktake(id: string): Promise<StocktakeCycle> {
  return apiGetStocktake(id)
}

export async function updateStocktake(
  id: string,
  body: UpdateStocktakeBody,
): Promise<StocktakeCycle> {
  return apiUpdateStocktake(id, body)
}

export async function recordStocktakeItem(
  cycleId: string,
  itemId: string,
  body: RecordStocktakeItemBody,
): Promise<StocktakeCycle> {
  return apiRecordStocktakeItem(cycleId, itemId, body)
}

export async function confirmStocktake(
  id: string,
  body: ConfirmStocktakeBody = {},
): Promise<StocktakeCycle> {
  return apiConfirmStocktake(id, body)
}

export async function exportStocktakeCsv(id: string) {
  return apiExportStocktakeCsv(id)
}
