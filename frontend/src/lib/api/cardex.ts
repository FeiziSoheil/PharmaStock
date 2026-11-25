import type { CardexMovement, CardexMovementType } from '@/lib/types/cardex'
import { apiRequest } from './http'

type ApiMovement = {
  id: string
  drugId: string
  timestampISO?: string
  timestamp?: string
  type: string
  batchNo: string
  qtyIn: number
  qtyOut: number
  actorName: string
  shiftLabel?: string
  note?: string
}

type ListEnvelope = {
  items: ApiMovement[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

function mapMovement(raw: ApiMovement): CardexMovement {
  return {
    id: raw.id,
    drugId: raw.drugId,
    timestampISO: raw.timestampISO || raw.timestamp || new Date().toISOString(),
    type: (raw.type as CardexMovementType) || 'adjustment',
    batchNo: raw.batchNo,
    qtyIn: raw.qtyIn ?? 0,
    qtyOut: raw.qtyOut ?? 0,
    actorName: raw.actorName ?? '',
    shiftLabel: raw.shiftLabel ?? '',
    note: raw.note ?? '',
  }
}

export async function apiGetCardexMovements(
  drugId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<{
  items: CardexMovement[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}> {
  const res = await apiRequest<ListEnvelope>(`/api/v1/drugs/${drugId}/cardex`, {
    query: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    },
  })
  return {
    items: (res.items ?? []).map(mapMovement),
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
    pageCount: res.pageCount,
  }
}
