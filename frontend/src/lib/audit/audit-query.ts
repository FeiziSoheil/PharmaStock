import { normalizePersianText } from '@/lib/persian'
import {
  AUDIT_ACTION_FILTER_GROUPS,
  type AuditActionCode,
  type AuditActionFilterGroup,
  type AuditEntityType,
  type AuditRole,
  type AuditSeverity,
} from '@/lib/domain/auditEvents'
import {
  resolveJalaliDateRange,
  type DateRangePreset,
} from '@/lib/audit/jalali-range'
import type { AuditSortField } from '@/lib/audit/url-state'
import type { AuditEvent } from '@/lib/types/audit'

export type AuditQueryParams = {
  range?: DateRangePreset
  fromJalali?: string
  toJalali?: string
  actorId?: string
  role?: AuditRole | ''
  /** Explicit multi-select action codes. */
  actions?: AuditActionCode[]
  /** Stitch single-select action group (expanded to codes). */
  actionGroup?: AuditActionFilterGroup | ''
  entityType?: AuditEntityType | ''
  severity?: AuditSeverity | ''
  search?: string
  sortBy?: AuditSortField
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  today?: Date
}

export type AuditQueryResult = {
  items: AuditEvent[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  /** Events matching filters before pagination (for export). */
  filtered: AuditEvent[]
}

function resolveActionCodes(params: AuditQueryParams): AuditActionCode[] | null {
  if (params.actions && params.actions.length > 0) return params.actions
  if (params.actionGroup && params.actionGroup !== 'all') {
    const group = AUDIT_ACTION_FILTER_GROUPS[params.actionGroup]
    if (group.codes) return [...group.codes]
  }
  return null
}

function matchesSearch(event: AuditEvent, rawSearch: string): boolean {
  const needle = normalizePersianText(rawSearch)
  if (!needle) return true
  const haystack = normalizePersianText(
    [
      event.description,
      event.entityId,
      event.id,
      event.entityLabel,
      event.actor.name,
      event.terminal,
      event.ip,
    ].join(' '),
  )
  return haystack.includes(needle)
}

function compareValues(
  a: string | number,
  b: string | number,
  dir: 'asc' | 'desc',
): number {
  const factor = dir === 'asc' ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * factor
  }
  return (
    String(a).localeCompare(String(b), 'fa', { sensitivity: 'base' }) * factor
  )
}

export function filterAuditEvents(
  events: AuditEvent[],
  params: AuditQueryParams = {},
): AuditEvent[] {
  const today = params.today ?? new Date()
  const rangeResult =
    params.range === 'custom'
      ? resolveJalaliDateRange({
          preset: 'custom',
          fromJalali: params.fromJalali ?? '',
          toJalali: params.toJalali ?? '',
          today,
        })
      : resolveJalaliDateRange({
          preset: params.range ?? 'week',
          today,
        })

  const actionCodes = resolveActionCodes(params)

  return events.filter((event) => {
    if (rangeResult.ok) {
      const ts = new Date(event.timestamp).getTime()
      const start = new Date(rangeResult.range.startIso).getTime()
      const end = new Date(rangeResult.range.endIso).getTime()
      if (ts < start || ts > end) return false
    } else if (params.range === 'custom') {
      // Invalid custom range matches nothing.
      return false
    }

    if (params.actorId && event.actor.id !== params.actorId) return false
    if (params.role && event.actor.role !== params.role) return false
    if (actionCodes && !actionCodes.includes(event.action)) return false
    if (params.entityType && event.entityType !== params.entityType) {
      return false
    }
    if (params.severity && event.severity !== params.severity) return false
    if (params.search && !matchesSearch(event, params.search)) return false
    return true
  })
}

export function sortAuditEvents(
  events: AuditEvent[],
  sortBy: AuditSortField = 'timestamp',
  sortDir: 'asc' | 'desc' = 'desc',
): AuditEvent[] {
  const sorted = [...events]
  sorted.sort((left, right) => {
    switch (sortBy) {
      case 'actor':
        return compareValues(left.actor.name, right.actor.name, sortDir)
      case 'action':
        return compareValues(left.action, right.action, sortDir)
      case 'entity':
        return compareValues(left.entityId, right.entityId, sortDir)
      case 'severity':
        return compareValues(left.severity, right.severity, sortDir)
      case 'timestamp':
      default:
        return compareValues(
          new Date(left.timestamp).getTime(),
          new Date(right.timestamp).getTime(),
          sortDir,
        )
    }
  })
  return sorted
}

export function paginateAuditEvents(
  events: AuditEvent[],
  page = 1,
  pageSize = 25,
): Omit<AuditQueryResult, 'filtered'> {
  const allowed = [25, 50, 100]
  const safeSize = allowed.includes(pageSize) ? pageSize : 25
  const total = events.length
  const pageCount = Math.max(1, Math.ceil(total / safeSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * safeSize
  return {
    items: events.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    pageCount,
    total,
  }
}

export function applyAuditQuery(
  events: AuditEvent[],
  params: AuditQueryParams = {},
): AuditQueryResult {
  const filtered = filterAuditEvents(events, params)
  const sorted = sortAuditEvents(
    filtered,
    params.sortBy ?? 'timestamp',
    params.sortDir ?? 'desc',
  )
  const page = paginateAuditEvents(sorted, params.page ?? 1, params.pageSize ?? 25)
  return { ...page, filtered: sorted }
}
