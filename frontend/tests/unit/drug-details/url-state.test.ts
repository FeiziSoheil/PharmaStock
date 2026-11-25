import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DRUG_DETAILS_URL_STATE,
  parseDrugDetailsUrlState,
  serializeDrugDetailsUrlState,
} from '@/lib/drug-details/url-state'

describe('parseDrugDetailsUrlState', () => {
  it('returns defaults for empty params', () => {
    expect(parseDrugDetailsUrlState(new URLSearchParams())).toEqual(
      DEFAULT_DRUG_DETAILS_URL_STATE,
    )
  })

  it('parses valid drugId, tab, filter, q, page, pageSize', () => {
    const params = new URLSearchParams({
      drugId: 'd-001',
      tab: 'cardex',
      batchFilter: 'expiring',
      q: 'M9041',
      page: '2',
      pageSize: '25',
    })
    expect(parseDrugDetailsUrlState(params)).toEqual({
      drugId: 'd-001',
      tab: 'cardex',
      batchFilter: 'expiring',
      q: 'M9041',
      page: 2,
      pageSize: 25,
    })
  })

  it('falls back invalid tab/filter/pageSize', () => {
    const params = new URLSearchParams({
      tab: 'nope',
      batchFilter: 'xyz',
      page: '0',
      pageSize: '99',
    })
    const state = parseDrugDetailsUrlState(params)
    expect(state.tab).toBe('batches')
    expect(state.batchFilter).toBe('all')
    expect(state.page).toBe(1)
    expect(state.pageSize).toBe(10)
  })
})

describe('serializeDrugDetailsUrlState', () => {
  it('round-trips non-default fields and omits empty drugId/q when empty', () => {
    const state = {
      drugId: 'd-002',
      tab: 'info' as const,
      batchFilter: 'quarantine' as const,
      q: '',
      page: 1,
      pageSize: 10,
    }
    const params = serializeDrugDetailsUrlState(state)
    expect(params.get('drugId')).toBe('d-002')
    expect(params.get('tab')).toBe('info')
    expect(params.get('batchFilter')).toBe('quarantine')
    expect(params.get('q')).toBeNull()
    expect(parseDrugDetailsUrlState(params).drugId).toBe('d-002')
  })
})
