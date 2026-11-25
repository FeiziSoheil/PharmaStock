export type ControlledTxType =
  | 'in_distributor'
  | 'out_prescription'
  | 'waste_return'

export type ControlledWasteMode = 'used_ampoule' | 'damaged_stock'

export type ControlledSource = 'ledger' | 'dispensing' | 'receipt' | 'seed'

export type ControlledSignedBy = {
  userId: string
  name: string
  role: string
  licenseNo?: string
}

export type ControlledLedgerEntry = {
  id: string
  seqNo: number
  timestamp: string
  drugId: string
  drugNameFa: string
  dosageStrength?: string
  manufacturer?: string
  unitLabel: string
  batchId?: string
  batchNo: string
  expiry?: string
  txType: ControlledTxType
  txSubLabel: string
  wasteMode?: ControlledWasteMode
  qtyIn: number
  qtyOut: number
  ampouleWasteCount: number
  balanceAfter: number
  vaultBinAddress?: string
  physicianName?: string
  physicianLicense?: string
  patientNationalIdMasked?: string
  patientNote?: string
  trackingCode: string
  sepasCode?: string
  technicalAck: boolean
  signedBy: ControlledSignedBy
  source: ControlledSource
  refId?: string
}

export type VaultBatchOption = {
  batchId: string
  batchNo: string
  expiry: string
  quantity: number
  binId: string
  locationLabel: string
}

export type VaultDrugStock = {
  drugId: string
  nameFa: string
  dosageForm: string
  strength: string
  manufacturer: string
  unitLabel: string
  availableStock: number
  reorderLevel: number
  isLowStock: boolean
  vaultAddresses: string[]
  activeBatches: VaultBatchOption[]
}

export type VaultBinOption = {
  id: string
  address: string
  zone: string
  zoneLabel: string
}

export type ControlledKpis = {
  totalVaultBalance: number
  controlledDrugCount: number
  monthInflow: number
  monthInflowShipments: number
  monthOutflow: number
  activePrescriptionCount: number
  wasteDestroyedCount: number
  totalEntries: number
  reconciliationPct: number
  lastAuditAt?: string
}

export type ControlledLedgerListResult = {
  items: ControlledLedgerEntry[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: ControlledKpis
  vaultItems: VaultDrugStock[]
  vaultBins: VaultBinOption[]
}

export type CreateControlledEntryInput = {
  drugId: string
  txType: ControlledTxType
  wasteMode?: ControlledWasteMode
  quantity: number
  batchId?: string
  batchNo: string
  expiry?: string
  binId?: string
  physicianName?: string
  physicianLicense?: string
  patientNationalId?: string
  patientNote?: string
  trackingCode: string
  sepasCode?: string
  technicalAck: boolean
}
