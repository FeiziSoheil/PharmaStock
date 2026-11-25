import type {
  AuditActor,
  AuditEvent,
  AuditKpis,
  AuditSecurityStatus,
  GetAuditEventsResult,
} from '@/lib/types/audit'
import type { AuditPayload } from '@/lib/audit/diff'
import type { AuditQueryParams } from '@/lib/audit/audit-query'
import {
  AUDIT_ACTION_FILTER_GROUPS,
  resolveAuditActionCode,
  resolveAuditEntityType,
  resolveAuditRole,
  resolveAuditSource,
  type AuditSeverity,
} from '@/lib/domain/auditEvents'
import { apiBaseUrl } from './config'
import { apiRequest, ApiError, handleUnauthorized } from './http'
import { getToken } from './session'

type ApiActor = {
  id: string
  name: string
  role: string
  initials: string
}

type ApiEvent = {
  id: string
  timestamp: string
  actor: ApiActor
  action: string
  entityType: string
  entityId: string
  entityLabel: string
  description: string
  severity: string
  source: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ip: string
  terminal: string
  securityStatus: string
  isControlledSubstance: boolean
}

type ApiKpis = {
  totalEvents?: number
  failureLogins?: number
  controlled?: number
  todayCount?: number
  controlledCount?: number
  failedSecurityCount?: number
}

type ListEnvelope = {
  items: ApiEvent[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  kpis: ApiKpis
  actors: ApiActor[]
}

function resolveActionParam(params: AuditQueryParams): string | undefined {
  if (params.actions && params.actions.length === 1) return params.actions[0]
  if (params.actions && params.actions.length > 1) {
    // Backend accepts a single action; prefer first explicit code.
    return params.actions[0]
  }
  if (params.actionGroup && params.actionGroup !== 'all') {
    const group = AUDIT_ACTION_FILTER_GROUPS[params.actionGroup]
    if (group?.codes && group.codes.length === 1) return group.codes[0]
  }
  return undefined
}

function mapActor(raw: ApiActor): AuditActor {
  return {
    id: raw.id,
    name: raw.name,
    role: resolveAuditRole(raw.role || ''),
    initials: raw.initials || raw.name.slice(0, 2),
  }
}

function mapPayload(
  raw: Record<string, unknown> | undefined,
): AuditPayload | undefined {
  if (!raw) return undefined
  const out: AuditPayload = {}
  for (const [key, value] of Object.entries(raw)) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value
    } else if (value !== undefined) {
      out[key] = String(value)
    }
  }
  return out
}

function mapSecurityStatus(raw: string | undefined): AuditSecurityStatus {
  if (raw === 'ok') return 'recorded'
  if (raw === 'alert') return 'needs_review'
  if (
    raw === 'token_ok' ||
    raw === 'recorded' ||
    raw === 'needs_review' ||
    raw === 'archived' ||
    raw === 'secured' ||
    raw === 'confirmed'
  ) {
    return raw
  }
  return 'recorded'
}

function mapEvent(raw: ApiEvent): AuditEvent {
  const ts =
    typeof raw.timestamp === 'string'
      ? raw.timestamp
      : new Date(raw.timestamp as unknown as string).toISOString()

  return {
    id: raw.id,
    timestamp: ts,
    actor: mapActor(raw.actor),
    action: resolveAuditActionCode(raw.action || ''),
    entityType: resolveAuditEntityType(raw.entityType || ''),
    entityId: raw.entityId,
    entityLabel: raw.entityLabel,
    description: raw.description,
    severity: (raw.severity as AuditSeverity) || 'info',
    source: resolveAuditSource(raw.source || 'api'),
    before: mapPayload(raw.before),
    after: mapPayload(raw.after),
    ip: raw.ip ?? '',
    terminal: raw.terminal ?? '',
    securityStatus: mapSecurityStatus(raw.securityStatus),
    isControlledSubstance: Boolean(raw.isControlledSubstance),
  }
}

function mapKpis(raw: ApiKpis | undefined, total: number): AuditKpis {
  return {
    todayCount: raw?.todayCount ?? raw?.totalEvents ?? total,
    controlledCount: raw?.controlledCount ?? raw?.controlled ?? 0,
    failedSecurityCount:
      raw?.failedSecurityCount ?? raw?.failureLogins ?? 0,
  }
}

export async function apiGetAuditEvents(
  params: AuditQueryParams = {},
): Promise<GetAuditEventsResult> {
  const res = await apiRequest<ListEnvelope>('/api/v1/audit-events', {
    query: {
      actorId: params.actorId,
      role: params.role || undefined,
      action: resolveActionParam(params),
      entityType: params.entityType || undefined,
      severity: params.severity || undefined,
      search: params.search,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      page: params.page,
      pageSize: params.pageSize,
      range: params.range,
      fromJalali: params.fromJalali,
      toJalali: params.toJalali,
    },
  })

  const items = (res.items ?? []).map(mapEvent)
  return {
    items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
    pageCount: res.pageCount,
    filtered: items,
    kpis: mapKpis(res.kpis, res.total),
    actors: (res.actors ?? []).map(mapActor),
  }
}

/** Download server-side export when API mode is on (csv|json). */
export async function apiExportAuditEvents(
  params: AuditQueryParams = {},
  format: 'csv' | 'json' = 'csv',
): Promise<Blob> {
  const url = new URL(`${apiBaseUrl()}/api/v1/audit-events/export`)
  url.searchParams.set('format', format)
  const action = resolveActionParam(params)
  const entries: Record<string, string | number | undefined> = {
    actorId: params.actorId,
    role: params.role || undefined,
    action,
    entityType: params.entityType || undefined,
    severity: params.severity || undefined,
    search: params.search,
    sortBy: params.sortBy,
    sortDir: params.sortDir ?? 'desc',
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const headers: Record<string, string> = { Accept: '*/*' }
  const token = getToken()
  if (!token) {
    handleUnauthorized()
    throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.', 'unauthorized')
  }
  headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(url.toString(), { headers })
  } catch {
    throw new ApiError(0, 'خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.', 'network_error')
  }
  if (!response.ok) {
    if (response.status === 401) handleUnauthorized()
    throw new ApiError(
      response.status,
      response.status === 401
        ? 'نشست منقضی شده است. دوباره وارد شوید.'
        : 'خروجی ممیزی دریافت نشد.',
      response.status === 401 ? 'unauthorized' : undefined,
    )
  }
  return response.blob()
}
