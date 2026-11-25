import type { BatchFilter, DrugDetailsTab, DrugDetailsUrlState } from './types'

export const DRUG_DETAILS_PAGE_SIZES = [10, 25, 50] as const

export const DEFAULT_DRUG_DETAILS_URL_STATE: DrugDetailsUrlState = {
  drugId: '',
  tab: 'batches',
  batchFilter: 'all',
  q: '',
  page: 1,
  pageSize: 10,
}

const TABS: DrugDetailsTab[] = ['batches', 'cardex', 'info']
const FILTERS: BatchFilter[] = ['all', 'in-stock', 'expiring', 'quarantine']

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.floor(n)
}

export function parseDrugDetailsUrlState(params: URLSearchParams): DrugDetailsUrlState {
  const tabRaw = params.get('tab') ?? ''
  const filterRaw = params.get('batchFilter') ?? ''
  const pageSize = parsePositiveInt(params.get('pageSize'), DEFAULT_DRUG_DETAILS_URL_STATE.pageSize)
  return {
    drugId: (params.get('drugId') ?? '').trim(),
    tab: (TABS as string[]).includes(tabRaw) ? (tabRaw as DrugDetailsTab) : 'batches',
    batchFilter: (FILTERS as string[]).includes(filterRaw)
      ? (filterRaw as BatchFilter)
      : 'all',
    q: (params.get('q') ?? '').trim(),
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: (DRUG_DETAILS_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_DRUG_DETAILS_URL_STATE.pageSize,
  }
}

export function serializeDrugDetailsUrlState(state: DrugDetailsUrlState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.drugId) params.set('drugId', state.drugId)
  if (state.tab !== DEFAULT_DRUG_DETAILS_URL_STATE.tab) params.set('tab', state.tab)
  if (state.batchFilter !== DEFAULT_DRUG_DETAILS_URL_STATE.batchFilter) {
    params.set('batchFilter', state.batchFilter)
  }
  if (state.q) params.set('q', state.q)
  if (state.page !== 1) params.set('page', String(state.page))
  if (state.pageSize !== DEFAULT_DRUG_DETAILS_URL_STATE.pageSize) {
    params.set('pageSize', String(state.pageSize))
  }
  return params
}
