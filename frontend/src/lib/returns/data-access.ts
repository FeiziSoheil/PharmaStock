import {
  confirmReturn as apiConfirmReturn,
  createReturn as apiCreateReturn,
  getEligibleReturns as apiGetEligibleReturns,
  getReturn as apiGetReturn,
  listReturns as apiListReturns,
  settleReturn as apiSettleReturn,
  type GetEligibleReturnsQuery,
  type ListReturnsQuery,
  type ListReturnsResult,
} from '@/lib/api/returns'
import type {
  CreateDistributorReturnInput,
  DistributorEligibilityResult,
  DistributorReturn,
  SettleDistributorReturnInput,
} from '@/lib/types/returns'

export type { GetEligibleReturnsQuery, ListReturnsQuery, ListReturnsResult }

export async function fetchEligibleReturns(
  params: GetEligibleReturnsQuery = {},
): Promise<DistributorEligibilityResult> {
  return apiGetEligibleReturns(params)
}

export async function fetchReturns(
  params: ListReturnsQuery = {},
): Promise<ListReturnsResult> {
  return apiListReturns(params)
}

export async function fetchReturn(id: string): Promise<DistributorReturn> {
  return apiGetReturn(id)
}

export async function createDistributorReturn(
  body: CreateDistributorReturnInput,
): Promise<DistributorReturn> {
  return apiCreateReturn(body)
}

export async function confirmDistributorReturn(
  id: string,
): Promise<DistributorReturn> {
  return apiConfirmReturn(id)
}

export async function settleDistributorReturn(
  id: string,
  body: SettleDistributorReturnInput = {},
): Promise<DistributorReturn> {
  return apiSettleReturn(id, body)
}
