import { describe, expect, it } from 'vitest'
import { applyAuditQuery, filterAuditEvents, sortAuditEvents } from '@/lib/audit/audit-query'
import {
  generateMockAuditEvents,
  MOCK_AUDIT_TODAY,
  type AuditEvent,
} from '../../fixtures/mock-audit-data'

const TODAY = MOCK_AUDIT_TODAY
const EVENTS = generateMockAuditEvents(TODAY, 200)

describe('audit query pipeline', () => {
  it('generates a fixed-seed catalog of ~200 events over ~60 days', () => {
    const again = generateMockAuditEvents(TODAY, 200)
    expect(EVENTS).toHaveLength(200)
    expect(again.map((e) => e.id)).toEqual(EVENTS.map((e) => e.id))
    const times = EVENTS.map((e) => new Date(e.timestamp).getTime())
    const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000
    expect(spanDays).toBeGreaterThan(30)
    expect(spanDays).toBeLessThanOrEqual(61)
  })

  it('defaults to newest-first sort', () => {
    const sorted = sortAuditEvents(EVENTS, 'timestamp', 'desc')
    for (let i = 1; i < sorted.length; i += 1) {
      expect(
        new Date(sorted[i - 1]!.timestamp).getTime(),
      ).toBeGreaterThanOrEqual(new Date(sorted[i]!.timestamp).getTime())
    }
  })

  it('filters by actor, severity, entity, and free-text (description / entity id)', () => {
    const sample = EVENTS.find((e) => e.action === 'login_failure')!
    const byActor = filterAuditEvents(EVENTS, {
      actorId: sample.actor.id,
      today: TODAY,
      range: 'last30',
    })
    expect(byActor.every((e) => e.actor.id === sample.actor.id)).toBe(true)

    const bySeverity = filterAuditEvents(EVENTS, {
      severity: 'critical',
      today: TODAY,
      range: 'last30',
    })
    expect(bySeverity.length).toBeGreaterThan(0)
    expect(bySeverity.every((e) => e.severity === 'critical')).toBe(true)

    const bySearch = filterAuditEvents(EVENTS, {
      search: sample.entityId,
      today: TODAY,
      range: 'last30',
    })
    expect(bySearch.some((e) => e.id === sample.id)).toBe(true)

    const byDescription = filterAuditEvents(EVENTS, {
      search: 'تلاش ناموفق ورود',
      today: TODAY,
      range: 'last30',
    })
    expect(byDescription.length).toBeGreaterThan(0)
  })

  it('filters multi-select actions and paginates', () => {
    const result = applyAuditQuery(EVENTS, {
      actions: ['login_failure', 'login_lock'],
      range: 'last30',
      today: TODAY,
      page: 1,
      pageSize: 25,
    })
    expect(result.filtered.length).toBeGreaterThan(0)
    expect(
      result.filtered.every(
        (e) => e.action === 'login_failure' || e.action === 'login_lock',
      ),
    ).toBe(true)
    expect(result.items.length).toBeLessThanOrEqual(25)
    expect(result.pageSize).toBe(25)
  })

  it('includes controlled-substance and failed-login events in catalog', () => {
    expect(EVENTS.some((e) => e.isControlledSubstance)).toBe(true)
    expect(EVENTS.some((e) => e.action === 'login_failure')).toBe(true)
    expect(EVENTS.some((e) => e.before && e.after)).toBe(true)
  })

  it('sorts by actor name ascending when requested', () => {
    const sorted = sortAuditEvents(EVENTS.slice(0, 40) as AuditEvent[], 'actor', 'asc')
    const names = sorted.map((e) => e.actor.name)
    const copy = [...names].sort((a, b) =>
      a.localeCompare(b, 'fa', { sensitivity: 'base' }),
    )
    expect(names).toEqual(copy)
  })
})
