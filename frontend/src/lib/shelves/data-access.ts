import { apiGetShelfById, apiGetShelves } from '@/lib/api/shelves'
import type { ShelfBin, ShelfKpis } from '@/lib/types/shelves'
import type { ShelfQueryParams, ShelfQueryResult } from '@/lib/shelves/shelf-query'

export async function fetchShelves(
  params: ShelfQueryParams = {},
): Promise<ShelfQueryResult & { kpis: ShelfKpis }> {
  return apiGetShelves(params)
}

export async function fetchShelfById(id: string): Promise<ShelfBin | null> {
  return apiGetShelfById(id)
}
