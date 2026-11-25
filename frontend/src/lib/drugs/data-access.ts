import {
  apiCreateDrug,
  apiGetDrugs,
  apiLookupTtac,
  apiSearchTtac,
  apiUpdateDrug,
  type DrugUpsertBody,
} from '@/lib/api/drugs'
import type { Drug, TtacLookupState, TtacSearchHit } from '@/lib/types/drugs'
import type { DrugQueryParams, DrugQueryResult } from '@/lib/drugs/catalog-query'

export async function fetchDrugs(
  params: DrugQueryParams = {},
): Promise<DrugQueryResult> {
  return apiGetDrugs(params)
}

export async function lookupTtac(rawQuery: string): Promise<TtacLookupState> {
  return apiLookupTtac(rawQuery)
}

export async function searchTtac(
  term: string,
  opts?: { page?: number; pageSize?: number; includeInactive?: boolean },
): Promise<{ items: TtacSearchHit[]; count: number; error?: string }> {
  return apiSearchTtac(term, opts)
}

export async function saveDrug(
  values: DrugUpsertBody,
  editingId: string | null,
): Promise<Drug> {
  if (editingId) return apiUpdateDrug(editingId, values)
  return apiCreateDrug(values)
}
