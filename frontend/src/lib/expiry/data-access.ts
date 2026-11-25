import {
  apiGetExpiryBatches,
  apiUpdateExpiryBatchStatus,
} from '@/lib/api/expiry'
import type {
  ExpiryBatch,
  ExpiryBatchStatus,
  GetExpiryBatchesResult,
} from '@/lib/types/expiry'
import type { ExpiryQueryParams } from '@/lib/expiry/expiry-query'

export async function fetchExpiryBatches(
  params: ExpiryQueryParams = {},
): Promise<GetExpiryBatchesResult> {
  return apiGetExpiryBatches(params)
}

export async function updateExpiryBatchStatus(
  batchId: string,
  status: ExpiryBatchStatus,
): Promise<ExpiryBatch | null> {
  return apiUpdateExpiryBatchStatus(batchId, status)
}
