import type {
  ShelfBatch,
  ShelfBin,
  ShelfKpis,
  ShelfZoneId,
} from '@/lib/types/shelves'
import type { ShelfQueryParams } from '@/lib/shelves/shelf-query'
import { apiRequest } from './http'

type ApiShelfBatch = {
  drugId: string
  nameFa: string
  batchNo: string
  expiry: string
  quantity: number
}

type ApiShelfBin = {
  id: string
  zone: string
  zoneLabel: string
  rack: string
  shelf: string
  bin: string
  address: string
  isControlled: boolean
  capacity: number
  macroLocation: string
  batches: ApiShelfBatch[]
  status?: string
}

type ListEnvelope = {
  items: ApiShelfBin[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: ShelfKpis
}

function mapBatch(b: ApiShelfBatch): ShelfBatch {
  return {
    drugId: b.drugId,
    nameFa: b.nameFa,
    batchNo: b.batchNo,
    expiry: b.expiry,
    quantity: b.quantity,
  }
}

function mapBin(raw: ApiShelfBin): ShelfBin {
  const macro = raw.macroLocation
  const macroLocation: ShelfBin['macroLocation'] =
    macro === 'dispensing' || macro === 'cold' || macro === 'controlled'
      ? macro
      : 'main'
  return {
    id: raw.id,
    zone: raw.zone as ShelfZoneId,
    zoneLabel: raw.zoneLabel,
    rack: raw.rack,
    shelf: raw.shelf,
    bin: raw.bin,
    address: raw.address,
    isControlled: Boolean(raw.isControlled),
    capacity: raw.capacity,
    batches: (raw.batches ?? []).map(mapBatch),
    macroLocation,
  }
}

export type ShelfListResult = {
  items: ShelfBin[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: ShelfKpis
}

export async function apiGetShelves(
  params: ShelfQueryParams = {},
): Promise<ShelfListResult> {
  // Backend: search/zone/macro/controlled/expiring. stockStatus is best-effort mapped.
  const controlledOnly =
    params.controlledOnly || params.stockStatus === 'controlled' || undefined
  const expiringSoon =
    params.expiringSoon || params.stockStatus === 'expiring' || undefined

  const res = await apiRequest<ListEnvelope>('/api/v1/shelves', {
    query: {
      search: params.search,
      zone: params.zone || undefined,
      controlledOnly: controlledOnly || undefined,
      expiringSoon: expiringSoon || undefined,
      macroLocation: params.macroLocation || undefined,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      page: params.page,
      pageSize: params.pageSize,
    },
  })

  return {
    items: (res.items ?? []).map(mapBin),
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
    pageCount: res.pageCount,
    kpis: res.kpis,
  }
}

export async function apiGetShelfById(id: string): Promise<ShelfBin | null> {
  try {
    const res = await apiRequest<ApiShelfBin>(`/api/v1/shelves/${id}`)
    return mapBin(res)
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: number }).status)
        : 0
    if (status === 404) return null
    throw err
  }
}
