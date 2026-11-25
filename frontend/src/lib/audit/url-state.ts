import type { AuditActionCode, AuditEntityType, AuditRole, AuditSeverity } from '@/lib/domain/auditEvents'
import { AUDIT_ACTION_CODES, AUDIT_ENTITY_TYPES, AUDIT_SEVERITIES, isAuditRole } from '@/lib/domain/auditEvents'
import type { DateRangePreset } from '@/lib/audit/jalali-range'

export type AuditSortField =
  | 'timestamp'
  | 'actor'
  | 'action'
  | 'entity'
  | 'severity'

export type AuditUrlState = {
  range: DateRangePreset
  from: string
  to: string
  actorId: string
  role: AuditRole | ''
  actions: AuditActionCode[]
  entityType: AuditEntityType | ''
  severity: AuditSeverity | ''
  q: string
  sortBy: AuditSortField
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const AUDIT_PAGE_SIZES = [25, 50, 100] as const
export const DEFAULT_AUDIT_URL_STATE: AuditUrlState = {
  range: 'week',
  from: '',
  to: '',
  actorId: '',
  role: '',
  actions: [],
  entityType: '',
  severity: '',
  q: '',
  sortBy: 'timestamp',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
}

const SORT_FIELDS: AuditSortField[] = [
  'timestamp',
  'actor',
  'action',
  'entity',
  'severity',
]

const RANGE_PRESETS: DateRangePreset[] = [
  'today',
  'week',
  'month',
  'last30',
  'custom',
]

function isActionCode(value: string): value is AuditActionCode {
  return (AUDIT_ACTION_CODES as string[]).includes(value)
}

function isEntityType(value: string): value is AuditEntityType {
  return value in AUDIT_ENTITY_TYPES
}

function isRole(value: string): value is AuditRole {
  return isAuditRole(value)
}

function isSeverity(value: string): value is AuditSeverity {
  return value in AUDIT_SEVERITIES
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.floor(n)
}

/** Parse shareable audit-log URL query into typed filter/sort/page state. */
export function parseAuditUrlState(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): AuditUrlState {
  const get = (key: string): string => {
    if (params instanceof URLSearchParams) {
      return params.get(key) ?? ''
    }
    const value = params[key]
    if (Array.isArray(value)) return value[0] ?? ''
    return value ?? ''
  }

  const rangeRaw = get('range')
  const range = (RANGE_PRESETS as string[]).includes(rangeRaw)
    ? (rangeRaw as DateRangePreset)
    : DEFAULT_AUDIT_URL_STATE.range

  const actionsRaw = get('actions')
  const actions = actionsRaw
    .split(',')
    .map((part) => part.trim())
    .filter(isActionCode)

  const roleRaw = get('role')
  const entityRaw = get('entity')
  const severityRaw = get('severity')
  const sortRaw = get('sort')
  const dirRaw = get('dir')
  const sizeRaw = parsePositiveInt(get('size') || null, DEFAULT_AUDIT_URL_STATE.pageSize)

  return {
    range,
    from: get('from'),
    to: get('to'),
    actorId: get('actor'),
    role: isRole(roleRaw) ? roleRaw : '',
    actions,
    entityType: isEntityType(entityRaw) ? entityRaw : '',
    severity: isSeverity(severityRaw) ? severityRaw : '',
    q: get('q'),
    sortBy: (SORT_FIELDS as string[]).includes(sortRaw)
      ? (sortRaw as AuditSortField)
      : DEFAULT_AUDIT_URL_STATE.sortBy,
    sortDir: dirRaw === 'asc' ? 'asc' : 'desc',
    page: parsePositiveInt(get('page') || null, 1),
    pageSize: (AUDIT_PAGE_SIZES as readonly number[]).includes(sizeRaw)
      ? sizeRaw
      : DEFAULT_AUDIT_URL_STATE.pageSize,
  }
}

/** Serialize audit URL state; omits defaults for cleaner share links. */
export function serializeAuditUrlState(
  state: AuditUrlState,
  defaults: AuditUrlState = DEFAULT_AUDIT_URL_STATE,
): URLSearchParams {
  const params = new URLSearchParams()

  if (state.range !== defaults.range) params.set('range', state.range)
  if (state.range === 'custom') {
    if (state.from) params.set('from', state.from)
    if (state.to) params.set('to', state.to)
  }
  if (state.actorId) params.set('actor', state.actorId)
  if (state.role) params.set('role', state.role)
  if (state.actions.length > 0) params.set('actions', state.actions.join(','))
  if (state.entityType) params.set('entity', state.entityType)
  if (state.severity) params.set('severity', state.severity)
  if (state.q.trim()) params.set('q', state.q.trim())
  if (state.sortBy !== defaults.sortBy) params.set('sort', state.sortBy)
  if (state.sortDir !== defaults.sortDir) params.set('dir', state.sortDir)
  if (state.page !== defaults.page) params.set('page', String(state.page))
  if (state.pageSize !== defaults.pageSize) {
    params.set('size', String(state.pageSize))
  }

  return params
}
