import type {
  Drug,
  TtacLookupState,
  TtacProduct,
  TtacSearchHit,
} from '@/lib/types/drugs'
import type { DrugQueryParams, DrugQueryResult } from '@/lib/drugs/catalog-query'
import { apiRequest } from './http'
import { fetchAllPages } from './paginate'

type ListEnvelope = {
  items: Drug[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function apiGetDrugs(
  params: DrugQueryParams = {},
): Promise<DrugQueryResult> {
  const isControlled =
    params.isControlled === null || params.isControlled === undefined
      ? undefined
      : params.isControlled

  return apiRequest<ListEnvelope>('/api/v1/drugs', {
    query: {
      search: params.search,
      dosageForm: params.dosageForm || undefined,
      category: params.category || undefined,
      isControlled,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      page: params.page,
      pageSize: params.pageSize,
    },
  })
}

export type DrugUpsertBody = {
  nameFa: string
  brandName: string
  dosageForm: string
  strength: string
  gtin: string
  genericCode: string
  manufacturer: string
  category: string
  isControlled: boolean
  atcCode?: string
  storageTemp?: string
  reorderLevel?: number
}

export async function apiFindDrugById(id: string): Promise<Drug | null> {
  const needle = id.trim()
  if (!needle) return null
  try {
    return await apiRequest<Drug>(`/api/v1/drugs/${needle}`)
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: number }).status)
        : 0
    if (status === 404) return null
    throw err
  }
}

export async function apiGetAllDrugs(): Promise<Drug[]> {
  return fetchAllPages((page, pageSize) => apiGetDrugs({ page, pageSize }))
}

export async function apiCreateDrug(body: DrugUpsertBody): Promise<Drug> {
  return apiRequest<Drug>('/api/v1/drugs', { method: 'POST', body })
}

export async function apiUpdateDrug(
  id: string,
  body: DrugUpsertBody,
): Promise<Drug> {
  return apiRequest<Drug>(`/api/v1/drugs/${id}`, { method: 'PUT', body })
}

type TtacSearchEnvelope = {
  items?: TtacSearchHit[]
  count?: number
  error?: string
}

export async function apiSearchTtac(
  term: string,
  opts?: { page?: number; pageSize?: number; includeInactive?: boolean },
): Promise<{ items: TtacSearchHit[]; count: number; error?: string }> {
  const q = term.trim()
  if (!q) return { items: [], count: 0 }
  const res = await apiRequest<TtacSearchEnvelope>('/api/v1/ttac/search', {
    query: {
      term: q,
      page: String(opts?.page ?? 1),
      pageSize: String(opts?.pageSize ?? 10),
      ...(opts?.includeInactive ? { includeInactive: 'true' } : {}),
    },
  })
  return {
    items: res.items ?? [],
    count: res.count ?? 0,
    ...(res.error ? { error: res.error } : {}),
  }
}

export async function apiLookupTtac(rawQuery: string): Promise<TtacLookupState> {
  const query = rawQuery.trim()
  if (!query) {
    return { status: 'error', message: 'کد GTIN یا IRC را وارد کنید.' }
  }
  try {
    const res = await apiRequest<
      | { status: 'found'; product: TtacProduct }
      | { status: 'not_found' }
      | { status: 'error'; message: string }
    >('/api/v1/ttac/lookup', { query: { q: query } })
    if (res.status === 'found') return { status: 'found', product: res.product }
    if (res.status === 'not_found') return { status: 'not_found' }
    return {
      status: 'error',
      message: res.message || 'ارتباط با سامانه تیتک برقرار نشد. دوباره تلاش کنید.',
    }
  } catch (err) {
    return {
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'ارتباط با سامانه تیتک برقرار نشد. دوباره تلاش کنید.',
    }
  }
}
