import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUDIT_URL_STATE,
  parseAuditUrlState,
  serializeAuditUrlState,
} from '@/lib/audit/url-state'

describe('audit URL state', () => {
  it('parses defaults from empty params', () => {
    expect(parseAuditUrlState(new URLSearchParams())).toEqual(
      DEFAULT_AUDIT_URL_STATE,
    )
  })

  it('parses filters, multi actions, sort, and pagination', () => {
    const state = parseAuditUrlState(
      new URLSearchParams(
        'range=custom&from=1403/08/01&to=1403/08/24&actor=usr-rezaei&role=technical_officer&actions=login_failure,quarantine&entity=batch&severity=critical&q=LOG-12&sort=actor&dir=asc&page=3&size=50',
      ),
    )
    expect(state).toMatchObject({
      range: 'custom',
      from: '1403/08/01',
      to: '1403/08/24',
      actorId: 'usr-rezaei',
      role: 'technical_officer',
      actions: ['login_failure', 'quarantine'],
      entityType: 'batch',
      severity: 'critical',
      q: 'LOG-12',
      sortBy: 'actor',
      sortDir: 'asc',
      page: 3,
      pageSize: 50,
    })
  })

  it('ignores unknown enums and invalid page sizes', () => {
    const state = parseAuditUrlState(
      new URLSearchParams(
        'range=nope&role=ghost&entity=xyz&severity=loud&sort=foo&size=12&page=0',
      ),
    )
    expect(state.range).toBe('week')
    expect(state.role).toBe('')
    expect(state.entityType).toBe('')
    expect(state.severity).toBe('')
    expect(state.sortBy).toBe('timestamp')
    expect(state.pageSize).toBe(25)
    expect(state.page).toBe(1)
  })

  it('round-trips non-default state and omits defaults', () => {
    const state = {
      ...DEFAULT_AUDIT_URL_STATE,
      severity: 'warning' as const,
      q: 'مورفین',
      page: 2,
      pageSize: 100,
    }
    const params = serializeAuditUrlState(state)
    expect(params.get('severity')).toBe('warning')
    expect(params.get('q')).toBe('مورفین')
    expect(params.get('page')).toBe('2')
    expect(params.get('size')).toBe('100')
    expect(params.get('range')).toBeNull()
    expect(parseAuditUrlState(params)).toMatchObject({
      severity: 'warning',
      q: 'مورفین',
      page: 2,
      pageSize: 100,
      range: 'week',
    })
  })
})
