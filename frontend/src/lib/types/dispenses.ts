export type DispenseStatus = 'draft' | 'confirmed' | 'cancelled'
export type DispenseAllocation = 'fefo' | 'manual'

export type DispensePatient = {
  nameFa: string
  nationalId?: string
  insuranceLabel?: string
  rxTrackingId?: string
}

export type DispenseControlled = {
  physicianName: string
  physicianLicense?: string
  recipientNationalId: string
  eRxTrackingId: string
  technicalAck: boolean
}

export type DispenseLine = {
  id: string
  drugId: string
  nameFa: string
  nameEn?: string
  irc?: string
  manufacturer?: string
  unitLabel: string
  quantity: number
  consumerPrice: number
  batchId: string
  batchNo: string
  expiry: string
  locationLabel: string
  binId?: string
  allocation: DispenseAllocation
  manualReason?: string
  isColdChain: boolean
  isControlled: boolean
  controlled?: DispenseControlled
}

export type DispenseFees = {
  technicalFee: number
  insuranceCover: number
}

export type DispenseOrder = {
  id: string
  status: DispenseStatus
  orderNo?: string
  patient: DispensePatient
  lines: DispenseLine[]
  fees: DispenseFees
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
  goodsTotal?: number
  patientPayable?: number
  lineCount?: number
  coldCount?: number
  controlledCount?: number
}

export type DispenseTotals = {
  goodsTotal: number
  technicalFee: number
  insuranceCover: number
  patientPayable: number
  lineCount: number
  coldCount: number
  controlledCount: number
}
