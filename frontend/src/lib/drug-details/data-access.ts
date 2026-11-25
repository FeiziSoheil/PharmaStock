import {
  apiFindDrugById,
  apiUpdateDrug,
  type DrugUpsertBody,
} from '@/lib/api/drugs'
import {
  apiCreateExpiryBatch,
  apiGetExpiryBatches,
  apiUpdateExpiryBatchLocation,
  apiUpdateExpiryBatchStatus,
} from '@/lib/api/expiry'
import { apiGetCardexMovements } from '@/lib/api/cardex'
import { fetchAllPages } from '@/lib/api/paginate'
import type { DrugBatchRow, DrugBatchStatus } from '@/lib/drug-details/types'
import { profileFromDrug } from '@/lib/drug-details/profile'
import type { CatalogEditInput } from '@/lib/drug-details/validation'
import type { ExpiryBatch, ExpiryBatchStatus } from '@/lib/types/expiry'
import type {
  AddBatchDalInput,
  DrugDetailProfile,
} from '@/lib/types/drug-details'
import type { CardexMovement } from '@/lib/types/cardex'

export type { CardexMovement, DrugDetailProfile, AddBatchDalInput }

/** Evaluation day for FEFO/batch filters — wall clock. */
export function drugDetailsTodayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mapExpiryStatus(status: ExpiryBatchStatus | string): DrugBatchStatus {
  if (status === 'quarantined' || status === 'marked_return') return 'quarantine'
  return 'active'
}

function expiryBatchToDrugBatchRow(batch: ExpiryBatch): DrugBatchRow {
  return {
    id: batch.batchId,
    drugId: batch.drugId,
    batchNo: batch.batchNo,
    productionISO: batch.productionISO || '',
    expiryISO: batch.expiry,
    buyPriceRial: batch.buyPriceRial ?? 0,
    consumerPriceRial: batch.consumerPriceRial ?? 0,
    quantity: batch.quantity,
    unitLabel: batch.unitLabel || 'عدد',
    locationLabel: batch.locationLabel || '',
    supplierLabel: batch.distributor || batch.manufacturer || '',
    status: mapExpiryStatus(batch.status),
    invoiceNo: batch.invoiceNo || undefined,
  }
}

async function fetchAllExpiryBatches(): Promise<ExpiryBatch[]> {
  return fetchAllPages((page, pageSize) =>
    apiGetExpiryBatches({ page, pageSize }).then((res) => ({
      items: res.items,
      page: res.page,
      pageCount: res.pageCount,
    })),
  )
}

export async function fetchDrugDetail(
  drugId: string,
): Promise<DrugDetailProfile | null> {
  const drug = await apiFindDrugById(drugId)
  if (!drug) return null
  return profileFromDrug(drug)
}

export async function fetchDrugBatches(drugId: string): Promise<DrugBatchRow[]> {
  const all = await fetchAllExpiryBatches()
  return all
    .filter((batch) => batch.drugId === drugId)
    .map(expiryBatchToDrugBatchRow)
}

export async function fetchCardexMovements(
  drugId: string,
): Promise<CardexMovement[]> {
  const res = await apiGetCardexMovements(drugId, { page: 1, pageSize: 50 })
  return res.items
}

export async function saveDrugCatalog(
  drugId: string,
  patch: Partial<CatalogEditInput>,
): Promise<DrugDetailProfile> {
  const current = await apiFindDrugById(drugId)
  if (!current) {
    throw new Error('دارو یافت نشد')
  }

  const body: DrugUpsertBody = {
    nameFa: patch.nameFa ?? current.nameFa,
    brandName: patch.brandName ?? current.brandName,
    dosageForm: patch.dosageForm ?? current.dosageForm,
    strength: patch.strength ?? current.strength,
    gtin: patch.gtin ?? current.gtin,
    genericCode: current.genericCode,
    manufacturer: patch.manufacturer ?? current.manufacturer,
    category: current.category,
    isControlled: patch.isControlled ?? current.isControlled,
    atcCode: patch.atcCode ?? current.atcCode,
    storageTemp: current.storageTemp,
    reorderLevel: patch.reorderLevel ?? current.reorderLevel,
  }

  const updated = await apiUpdateDrug(drugId, body)
  return profileFromDrug(updated)
}

export async function createDrugBatch(
  input: AddBatchDalInput,
): Promise<DrugBatchRow> {
  const created = await apiCreateExpiryBatch({
    drugId: input.drugId,
    batchNo: input.batchNo,
    expiry: input.expiryISO,
    quantity: input.quantity,
    unitLabel: input.unitLabel,
    locationLabel: input.locationLabel,
    binId: input.binId,
    manufacturer: undefined,
    distributor: input.supplierLabel,
    invoiceNo: input.invoiceNo,
    productionISO: input.productionISO,
    buyPriceRial: input.buyPriceRial,
    consumerPriceRial: input.consumerPriceRial,
    status: input.status === 'quarantine' ? 'quarantined' : 'active',
  })
  return expiryBatchToDrugBatchRow(created)
}

export async function relocateDrugBatch(
  batchId: string,
  locationLabel: string,
): Promise<DrugBatchRow> {
  const updated = await apiUpdateExpiryBatchLocation(batchId, { locationLabel })
  return expiryBatchToDrugBatchRow(updated)
}

export async function quarantineDrugBatch(
  batchId: string,
): Promise<DrugBatchRow> {
  const updated = await apiUpdateExpiryBatchStatus(batchId, 'quarantined')
  if (!updated) {
    throw new Error('سری‌ساخت یافت نشد')
  }
  return expiryBatchToDrugBatchRow(updated)
}
