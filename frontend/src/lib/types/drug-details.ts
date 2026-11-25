import type { CardexMovement } from '@/lib/types/cardex'
import type { DrugBatchRow } from '@/lib/drug-details/types'
import type { AddBatchInput } from '@/lib/drug-details/validation'

export type { CardexMovement }

export type DrugDetailProfile = {
  drugId: string
  nameEn: string
  irc: string
  legalClassLabel: string
  storageLabel: string
  fefoEnabled: boolean
  rxLabel: string
  clinicalNotes: string[]
  logisticsNotes: string[]
  supplierName: string
  nameFa: string
  brandName: string
  manufacturer: string
  atcCode: string
  gtin: string
  dosageForm: string
  strength: string
  reorderLevel: number
  isControlled: boolean
}

export type AddBatchDalInput = AddBatchInput & {
  drugId: string
  invoiceNo?: string
  unitLabel?: string
  status?: DrugBatchRow['status']
  binId?: string
}
