export const REORDER_DISTRIBUTORS = [
  { id: 'daroupakhsh', nameFa: 'داروپخش' },
  { id: 'hejrat', nameFa: 'پخش هجرت' },
  { id: 'razi', nameFa: 'پخش رازی' },
  { id: 'alborz', nameFa: 'پخش البرز' },
  { id: 'ferdows', nameFa: 'پخش فردوس' },
  { id: 'abidi', nameFa: 'داروسازی عبیدی' },
] as const

export type ReorderDistributorId = (typeof REORDER_DISTRIBUTORS)[number]['id']

export type ReorderKpis = {
  belowRopCount: number
  zeroStockCount: number
  estimatedValue: number
  avgLeadTimeDays: number
  yesterdayDelta: number
  byDistributor: { id: string; nameFa: string; count: number }[]
}

export type ReorderFormulaMode = 'drug_defaults' | 'dynamic_adu'

export type ReorderFormulaConfig = {
  mode: ReorderFormulaMode
  safetyStockDays: number
  targetCoverageDays: number
  defaultBufferPct: 0 | 10 | 20
  includeOnOrder: boolean
  roundToPackSize: boolean
  criticalDays: number
  lowDays: number
  reorderDays: number
}

export const DEFAULT_REORDER_FORMULA: ReorderFormulaConfig = {
  mode: 'drug_defaults',
  safetyStockDays: 3,
  targetCoverageDays: 14,
  defaultBufferPct: 10,
  includeOnOrder: true,
  roundToPackSize: true,
  criticalDays: 2,
  lowDays: 5,
  reorderDays: 14,
}

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'approved' | 'cancelled'

export type PurchaseOrderItem = {
  suggestionId: string
  drugId: string
  nameFa?: string
  dosageForm?: string
  strength?: string
  irc?: string
  unitLabel?: string
  packSize?: number
  unitCost?: number
  finalQty: number
  lineTotal?: number
  isControlled?: boolean
}

export type PurchaseOrder = {
  id: string
  orderNumber: string
  batchId?: string
  distributorId: string
  distributorNameFa: string
  status: PurchaseOrderStatus
  bufferPct: number
  itemCount: number
  totalQty: number
  totalCost: number
  hasControlled: boolean
  technicalConfirm: boolean
  notes?: string
  actorId: string
  actorName?: string
  createdAt: string
  updatedAt: string
  items: PurchaseOrderItem[]
}
