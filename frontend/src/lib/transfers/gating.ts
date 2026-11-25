import type { InternalTransfer, TransferLine } from '@/lib/types/transfers'

export function sumTransferUnits(lines: TransferLine[]): number {
  return lines.reduce(
    (sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0),
    0,
  )
}

export function stagedQuantityForBatch(
  lines: TransferLine[],
  sourceBatchId: string,
  excludeLineId?: string,
): number {
  return lines.reduce((sum, l) => {
    if (l.sourceBatchId !== sourceBatchId) return sum
    if (excludeLineId && l.id === excludeLineId) return sum
    return sum + (Number.isFinite(l.quantity) ? l.quantity : 0)
  }, 0)
}

export function remainingBatchQuantity(
  batchQuantity: number,
  lines: TransferLine[],
  sourceBatchId: string,
  excludeLineId?: string,
): number {
  const staged = stagedQuantityForBatch(lines, sourceBatchId, excludeLineId)
  return Math.max(0, batchQuantity - staged)
}

export function canAdvanceToStep2(lines: TransferLine[]): boolean {
  return (
    lines.length > 0 &&
    lines.every(
      (l) =>
        Boolean(l.sourceBatchId) &&
        Boolean(l.drugId) &&
        Boolean(l.batchNo) &&
        typeof l.quantity === 'number' &&
        Number.isFinite(l.quantity) &&
        l.quantity > 0,
    )
  )
}

export function canConfirmTransfer(transfer: InternalTransfer): boolean {
  if (transfer.status !== 'draft') return false
  if (!canAdvanceToStep2(transfer.lines)) return false
  return transfer.lines.every(
    (l) => Boolean(l.destLocationLabel?.trim()) || Boolean(l.destBinId?.trim()),
  )
}
