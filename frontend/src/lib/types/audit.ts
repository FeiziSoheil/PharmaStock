import type { AuditPayload } from '@/lib/audit/diff'
import type {
  AuditActionCode,
  AuditEntityType,
  AuditRole,
  AuditSeverity,
  AuditSource,
} from '@/lib/domain/auditEvents'

export type AuditActor = {
  id: string
  name: string
  role: AuditRole
  initials: string
}

export type AuditSecurityStatus =
  | 'token_ok'
  | 'recorded'
  | 'needs_review'
  | 'archived'
  | 'secured'
  | 'confirmed'

export type AuditEvent = {
  id: string
  timestamp: string
  actor: AuditActor
  action: AuditActionCode
  entityType: AuditEntityType
  entityId: string
  entityLabel: string
  description: string
  severity: AuditSeverity
  source: AuditSource
  before?: AuditPayload
  after?: AuditPayload
  ip: string
  terminal: string
  securityStatus: AuditSecurityStatus
  isControlledSubstance: boolean
}

export type AuditKpis = {
  todayCount: number
  controlledCount: number
  failedSecurityCount: number
}

export type GetAuditEventsResult = {
  items: AuditEvent[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  filtered: AuditEvent[]
  kpis: AuditKpis
  actors: AuditActor[]
}
