export type ReturnWindowDays = 60 | 90 | 120 | 180

export type ReturnSlipStatus = 'draft' | 'confirmed' | 'settled' | 'cancelled'

export type ReturnUrgency = 'expired' | 'urgent' | 'golden' | 'watch'

export type EligibleReturnBatch = {
  batchId: string
  drugId: string
  nameFa: string
  dosageForm: string
  strength: string
  manufacturer: string
  irc: string
  batchNo: string
  expiry: string
  daysUntilExpiry: number
  quantity: number
  unitLabel: string
  buyPriceRial: number
  totalValueRial: number
  status: string
  locationLabel: string
  distributorId: string
  distributorName: string
  contractReason: string
  urgency: ReturnUrgency
  isControlled: boolean
}

export type DistributorReturnGroup = {
  distributorId: string
  distributorName: string
  distributorCode: string
  customerCode: string
  visitorName: string
  depositLocation: string
  batchCount: number
  totalQty: number
  totalValueRial: number
  nearestDays: number
  nearestExpiry: string
  items: EligibleReturnBatch[]
}

export type DistributorReturnKpis = {
  totalBatches: number
  urgentBatches: number
  totalValueRial: number
  activeDistributors: number
  distributorNames: string[]
  pendingVisitorSlips: number
}

export type DistributorEligibilityResult = {
  windowDays: number
  todayISO: string
  kpis: DistributorReturnKpis
  groups: DistributorReturnGroup[]
}

export type DistributorReturnLine = {
  id: string
  batchId: string
  drugId: string
  nameFa: string
  dosageForm?: string
  strength?: string
  manufacturer?: string
  irc?: string
  batchNo: string
  expiry: string
  quantity: number
  availableQty: number
  unitLabel: string
  buyPriceRial: number
  lineTotalRial: number
  locationLabel?: string
  reason: string
  isControlled: boolean
}

export type DistributorReturn = {
  id: string
  returnNo?: string
  status: ReturnSlipStatus
  distributorId: string
  distributorName: string
  distributorCode?: string
  customerCode?: string
  visitorName?: string
  creditNoteNo?: string
  windowDays: number
  note?: string
  lines: DistributorReturnLine[]
  totalQty: number
  totalValueRial: number
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
  settledAt?: string
}

export type CreateDistributorReturnInput = {
  distributorId: string
  windowDays: number
  visitorName?: string
  note?: string
  lines: Array<{
    batchId: string
    quantity: number
    reason?: string
  }>
}

export type SettleDistributorReturnInput = {
  visitorName?: string
  creditNoteNo?: string
  note?: string
}
