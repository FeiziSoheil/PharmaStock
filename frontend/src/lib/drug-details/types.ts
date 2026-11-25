export type DrugDetailsTab = 'batches' | 'cardex' | 'info'
export type BatchFilter = 'all' | 'in-stock' | 'expiring' | 'quarantine'

export type DrugBatchStatus = 'active' | 'quarantine' | 'blocked'

export type DrugBatchRow = {
  id: string
  drugId: string
  batchNo: string
  productionISO: string
  expiryISO: string
  buyPriceRial: number
  consumerPriceRial: number
  quantity: number
  unitLabel: string
  locationLabel: string
  supplierLabel: string
  status: DrugBatchStatus
  invoiceNo?: string
}

export type DrugDetailsUrlState = {
  drugId: string
  tab: DrugDetailsTab
  batchFilter: BatchFilter
  q: string
  page: number
  pageSize: number
}
