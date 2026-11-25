import type {
  CreateDistributorReturnInput,
  DistributorReturnGroup,
  EligibleReturnBatch,
} from '@/lib/types/returns'

export type ReturnBatchOverride = {
  quantity: number
  reason?: string
}

export type SelectedDistributorDraft = {
  distributorId: string
  distributorName: string
  distributorCode: string
  customerCode: string
  visitorName: string
  items: Array<
    EligibleReturnBatch & {
      returnQty: number
      returnReason: string
      lineTotalRial: number
    }
  >
  totalQty: number
  totalValueRial: number
}

export function clampReturnQuantity(requested: number, maxAvailable: number): number {
  if (!Number.isFinite(requested) || maxAvailable <= 0) return 1
  const rounded = Math.trunc(requested)
  if (rounded < 1) return 1
  if (rounded > maxAvailable) return maxAvailable
  return rounded
}

export function resolveBatchReturnQty(
  batch: Pick<EligibleReturnBatch, 'batchId' | 'quantity'>,
  overrides: Readonly<Record<string, ReturnBatchOverride>>,
): number {
  const ov = overrides[batch.batchId]
  if (!ov) return batch.quantity
  return clampReturnQuantity(ov.quantity, batch.quantity)
}

export function resolveBatchReturnReason(
  batch: Pick<EligibleReturnBatch, 'batchId' | 'contractReason'>,
  overrides: Readonly<Record<string, ReturnBatchOverride>>,
): string {
  const custom = overrides[batch.batchId]?.reason?.trim()
  return custom || batch.contractReason
}

export function computeGroupSelectionSummary(
  group: DistributorReturnGroup,
  selectedBatchIds: ReadonlySet<string>,
  overrides: Readonly<Record<string, ReturnBatchOverride>>,
): {
  selectedCount: number
  totalQty: number
  totalValueRial: number
  allSelected: boolean
  someSelected: boolean
} {
  let selectedCount = 0
  let totalQty = 0
  let totalValueRial = 0

  for (const item of group.items) {
    if (!selectedBatchIds.has(item.batchId)) continue
    selectedCount += 1
    const qty = resolveBatchReturnQty(item, overrides)
    totalQty += qty
    totalValueRial += qty * item.buyPriceRial
  }

  return {
    selectedCount,
    totalQty,
    totalValueRial,
    allSelected: group.items.length > 0 && selectedCount === group.items.length,
    someSelected: selectedCount > 0 && selectedCount < group.items.length,
  }
}

export function buildSelectedDistributorDrafts(
  groups: readonly DistributorReturnGroup[],
  selectedBatchIds: ReadonlySet<string>,
  overrides: Readonly<Record<string, ReturnBatchOverride>>,
): SelectedDistributorDraft[] {
  const drafts: SelectedDistributorDraft[] = []

  for (const group of groups) {
    const picked = group.items.filter((item) => selectedBatchIds.has(item.batchId))
    if (picked.length === 0) continue

    let totalQty = 0
    let totalValueRial = 0
    const items = picked.map((item) => {
      const returnQty = resolveBatchReturnQty(item, overrides)
      const returnReason = resolveBatchReturnReason(item, overrides)
      const lineTotalRial = returnQty * item.buyPriceRial
      totalQty += returnQty
      totalValueRial += lineTotalRial
      return {
        ...item,
        returnQty,
        returnReason,
        lineTotalRial,
      }
    })

    drafts.push({
      distributorId: group.distributorId,
      distributorName: group.distributorName,
      distributorCode: group.distributorCode,
      customerCode: group.customerCode,
      visitorName: group.visitorName,
      items,
      totalQty,
      totalValueRial,
    })
  }

  return drafts
}

export function toCreateReturnPayloads(
  drafts: readonly SelectedDistributorDraft[],
  windowDays: number,
  note?: string,
): CreateDistributorReturnInput[] {
  return drafts.map((draft) => ({
    distributorId: draft.distributorId,
    windowDays,
    visitorName: draft.visitorName,
    note: note?.trim() || undefined,
    lines: draft.items.map((item) => ({
      batchId: item.batchId,
      quantity: item.returnQty,
      reason: item.returnReason,
    })),
  }))
}

export function defaultSelectedUrgentBatchIds(
  groups: readonly DistributorReturnGroup[],
): Set<string> {
  const next = new Set<string>()
  for (const group of groups) {
    for (const item of group.items) {
      if (
        item.status === 'marked_return' ||
        item.urgency === 'urgent' ||
        item.urgency === 'expired' ||
        item.daysUntilExpiry <= 30
      ) {
        next.add(item.batchId)
      }
    }
  }
  return next
}
