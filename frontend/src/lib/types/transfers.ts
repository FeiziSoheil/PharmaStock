export type TransferStatus = 'draft' | 'confirmed' | 'cancelled'
export type TransferReason =
  | 'routine_front'
  | 'urgent_rx'
  | 'night_cap'
  | 'fefo_move'
export type MatchStatus = 'barcode' | 'physical'

export type TransferHeader = {
  reason: TransferReason
  sourceZone: string
  destZone: string
  sourceLabel: string
  destLabel: string
  note?: string
  receiverName?: string
}

export type TransferLine = {
  id: string
  drugId: string
  nameFa: string
  batchNo: string
  expiry: string
  sourceBatchId: string
  sourceBinId?: string
  sourceLocationLabel: string
  destBinId?: string
  destLocationLabel?: string
  quantity: number
  unitLabel: string
  matchStatus: MatchStatus
}

export type InternalTransfer = {
  id: string
  status: TransferStatus
  currentStep: 1 | 2
  header: TransferHeader
  lines: TransferLine[]
  transferNo?: string
  resultBatchIds?: string[]
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
}

export const TRANSFER_REASON_LABELS: Record<TransferReason, string> = {
  routine_front: 'شارژ روتین پیشخوان نسخه‌پیچی',
  urgent_rx: 'کسری نسخه فوری و بیمار در انتظار',
  night_cap: 'تکمیل سقف موجودی شیفت شب',
  fefo_move: 'جابجایی بر اساس تاریخ انقضای نزدیک (FEFO)',
}
