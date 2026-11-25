/**
 * Audit log data access (mock).
 *
 * READ-ONLY and append-only: this layer never exposes edit, delete, or
 * "clear log" operations. Events are immutable once generated. A future
 * backend may replace `getAuditEvents` without changing that contract.
 */

import { applyAuditQuery, type AuditQueryParams, type AuditQueryResult } from '@/lib/audit/audit-query'
import type { AuditPayload } from '@/lib/audit/diff'
import {
  AUDIT_ACTION_CODES,
  AUDIT_ROLES,
  type AuditActionCode,
  type AuditEntityType,
  type AuditRole,
  type AuditSeverity,
  type AuditSource,
} from '@/lib/domain/auditEvents'
import { MOCK_DRUGS } from './mock-drugs-data'

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

export const MOCK_AUDIT_ACTORS: AuditActor[] = [
  {
    id: 'usr-rezaei',
    name: 'دکتر رضایی',
    role: 'technical_officer',
    initials: 'د.ر',
  },
  {
    id: 'usr-kazemi',
    name: 'مرتضی کاظمی',
    role: 'warehouse_lead',
    initials: 'م.ک',
  },
  {
    id: 'usr-yazdani',
    name: 'الهام یزدانی',
    role: 'intake_clerk',
    initials: 'ا.ی',
  },
  {
    id: 'usr-hosseini',
    name: 'سارا حسینی',
    role: 'pharmacist',
    initials: 'س.ح',
  },
  {
    id: 'usr-system',
    name: 'هماهنگ‌ساز خودکار',
    role: 'system',
    initials: 'سیس',
  },
]

const SECURITY_BY_SEVERITY: Record<AuditSeverity, AuditSecurityStatus[]> = {
  info: ['token_ok', 'recorded', 'archived', 'confirmed'],
  warning: ['needs_review', 'recorded'],
  critical: ['secured', 'needs_review'],
}

const TERMINALS = [
  { ip: '192.168.1.18', terminal: 'کانتر نسخه ۱ (کلاینت دکتر)' },
  { ip: '192.168.1.45', terminal: 'هندهلد انبار غربی (Scanner 2)' },
  { ip: '192.168.1.22', terminal: 'کانتر اسناد مالی (دفتر حسابداری)' },
  { ip: '10.0.4.12', terminal: 'سرور ادغام مرکزی (Gateway)' },
  { ip: '127.0.0.1', terminal: 'سرویس خودکار TTAC Webhook' },
]

/** Fixed seed reference "today" matching Stitch sample (۱۴۰۳/۰۸/۲۴ ≈ 2024-11-14). */
export const MOCK_AUDIT_TODAY = new Date(Date.UTC(2024, 10, 14, 12, 0, 0))

const DELAY_MS = 280

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

function padLogId(n: number): string {
  return `LOG-${String(n).padStart(5, '0')}`
}

function severityForAction(action: AuditActionCode, rng: () => number): AuditSeverity {
  if (
    action === 'login_failure' ||
    action === 'login_lock' ||
    action === 'quarantine' ||
    action === 'controlled_dispense'
  ) {
    return rng() > 0.35 ? 'critical' : 'warning'
  }
  if (
    action === 'expiry_action_confirmed' ||
    action === 'stocktake_adjust' ||
    action === 'role_change' ||
    action === 'price_mod'
  ) {
    return rng() > 0.5 ? 'warning' : 'info'
  }
  return 'info'
}

function buildPayload(
  action: AuditActionCode,
  rng: () => number,
): { before?: AuditPayload; after?: AuditPayload } {
  const qty = 20 + Math.floor(rng() * 80)
  const delta = 1 + Math.floor(rng() * 6)
  switch (action) {
    case 'controlled_dispense':
    case 'dispensing':
    case 'stocktake_adjust':
      return {
        before: { quantity: qty, unit: 'عدد' },
        after: { quantity: qty - delta, unit: 'عدد' },
      }
    case 'stock_receipt':
      return {
        before: { itemsAdded: 0 },
        after: { itemsAdded: 100 + Math.floor(rng() * 500) },
      }
    case 'transfer':
    case 'shelf_move':
      return {
        before: { location: 'سردخانه ردیف B' },
        after: { location: 'یخچال توزیع سریع' },
      }
    case 'price_mod':
      return {
        before: { price: 850000 },
        after: { price: 920000 },
      }
    case 'quarantine':
      return {
        before: { status: 'آزاد برای فروش' },
        after: { status: 'قرنطینه فیزیکی (قفسه قرمز)' },
      }
    case 'role_change':
      return {
        before: { role: AUDIT_ROLES.intake_clerk.labelFa },
        after: { role: AUDIT_ROLES.pharmacist.labelFa },
      }
    case 'item_edited':
      return {
        before: { reorderLevel: 100 },
        after: { reorderLevel: 150 },
      }
    default:
      return {}
  }
}

function entityForAction(
  action: AuditActionCode,
  drug: (typeof MOCK_DRUGS)[number],
  rng: () => number,
): { entityType: AuditEntityType; entityId: string; entityLabel: string } {
  const batchNo = `BT-${1000 + Math.floor(rng() * 8000)}`
  switch (action) {
    case 'login_success':
    case 'login_failure':
    case 'login_lock':
      return {
        entityType: 'session',
        entityId: `SESS-${10000 + Math.floor(rng() * 80000)}`,
        entityLabel: 'نشست امنیتی پرسنل',
      }
    case 'role_change':
      return {
        entityType: 'user_access',
        entityId: `USR-${100 + Math.floor(rng() * 80)}`,
        entityLabel: 'پروفایل دسترسی پرسنل',
      }
    case 'stock_receipt':
      return {
        entityType: 'invoice',
        entityId: `INV-${80000 + Math.floor(rng() * 9000)}`,
        entityLabel: `فاکتور پخش #INV-${80000 + Math.floor(rng() * 9000)}`,
      }
    case 'dispensing':
    case 'return_to_distributor':
      return {
        entityType: 'outbound',
        entityId: `OUT-${4000 + Math.floor(rng() * 5000)}`,
        entityLabel: drug.nameFa,
      }
    case 'controlled_dispense':
    case 'controlled_substance_entry':
      return {
        entityType: 'narcotic_book',
        entityId: `NC-${4000 + Math.floor(rng() * 999)}`,
        entityLabel: `دفتر مخدر #NC-${4000 + Math.floor(rng() * 999)}`,
      }
    case 'price_mod':
      return {
        entityType: 'pricing',
        entityId: drug.id,
        entityLabel: drug.nameFa,
      }
    case 'item_created':
    case 'item_edited':
    case 'reorder_drafted':
      return {
        entityType: 'drug',
        entityId: drug.id,
        entityLabel: drug.nameFa,
      }
    case 'shelf_move':
      return {
        entityType: 'shelf',
        entityId: `A-${1 + Math.floor(rng() * 4)}-${1 + Math.floor(rng() * 8)}-${1 + Math.floor(rng() * 4)}`,
        entityLabel: drug.nameFa,
      }
    default:
      return {
        entityType: 'batch',
        entityId: batchNo,
        entityLabel: `کاردکس بچ #${batchNo}`,
      }
  }
}

function describe(
  action: AuditActionCode,
  drug: (typeof MOCK_DRUGS)[number],
  entityId: string,
): string {
  switch (action) {
    case 'login_success':
      return 'ورود موفق به سامانه انبار دارو'
    case 'login_failure':
      return 'تلاش ناموفق ورود — اعتبارسنجی رد شد'
    case 'login_lock':
      return 'قفل موقت حساب پس از تلاش‌های ناموفق متوالی'
    case 'item_created':
      return `ثبت داروی جدید: ${drug.nameFa}`
    case 'item_edited':
      return `ویرایش مشخصات ${drug.nameFa}`
    case 'shelf_move':
      return `جابجایی فیزیکی ${drug.nameFa} به موقعیت ${entityId}`
    case 'expiry_action_confirmed':
      return `تایید اقدام انقضا برای ${drug.nameFa}`
    case 'reorder_drafted':
      return `پیش‌نویس سفارش کسری برای ${drug.nameFa}`
    case 'stock_receipt':
      return `تایید رسید فاکتور و افزایش موجودی ${drug.nameFa}`
    case 'transfer':
      return `انتقال بین‌انباری بچ مرتبط با ${drug.nameFa}`
    case 'dispensing':
      return `نسخه‌پیچی و ترخیص ${drug.nameFa}`
    case 'controlled_dispense':
      return `کاهش موجودی داروی تحت کنترل ${drug.nameFa}`
    case 'return_to_distributor':
      return `مرجوعی ${drug.nameFa} به شرکت پخش`
    case 'stocktake_adjust':
      return `اصلاح موجودی فیزیکی ${drug.nameFa} پس از انبارگردانی`
    case 'role_change':
      return 'تغییر نقش دسترسی پرسنل'
    case 'controlled_substance_entry':
      return `ثبت ورود داروی تحت کنترل ${drug.nameFa}`
    case 'price_mod':
      return `تغییر نرخ مصرف‌کننده مصوب برای ${drug.nameFa}`
    case 'quarantine':
      return `مسدودسازی فروش بچ مرتبط با ${drug.nameFa}`
    default:
      return `رویداد سامانه برای ${drug.nameFa}`
  }
}

/**
 * Deterministic ~200 events over ~60 days relative to injectable `today`.
 * Seed is fixed — not random per render.
 */
export function generateMockAuditEvents(
  today: Date = MOCK_AUDIT_TODAY,
  count = 200,
): AuditEvent[] {
  const rng = mulberry32(0x51a7d10c)
  const events: AuditEvent[] = []
  const controlledDrugs = MOCK_DRUGS.filter((d) => d.isControlled)
  const allDrugs = MOCK_DRUGS

  // Seed a failed-login burst near "today"
  for (let i = 0; i < 8; i += 1) {
    const minutesAgo = 40 + i * 3
    const ts = new Date(today.getTime() - minutesAgo * 60_000)
    const actor = MOCK_AUDIT_ACTORS[2]!
    events.push({
      id: padLogId(99000 - i),
      timestamp: ts.toISOString(),
      actor,
      action: i === 7 ? 'login_lock' : 'login_failure',
      entityType: 'session',
      entityId: `SESS-FAIL-${i + 1}`,
      entityLabel: 'نشست امنیتی پرسنل',
      description:
        i === 7
          ? 'قفل موقت حساب پس از تلاش‌های ناموفق متوالی'
          : 'تلاش ناموفق ورود — اعتبارسنجی رد شد',
      severity: 'critical',
      source: 'ui',
      ip: '192.168.1.88',
      terminal: 'پایانه ورود وب',
      securityStatus: 'needs_review',
      isControlledSubstance: false,
    })
  }

  while (events.length < count) {
    const dayOffset = Math.floor(rng() * 60)
    const minuteOfDay = Math.floor(rng() * 24 * 60)
    const ts = new Date(
      today.getTime() - dayOffset * 86_400_000 - minuteOfDay * 60_000,
    )
    const action = pick(rng, AUDIT_ACTION_CODES)
    const actor =
      action.startsWith('login') || action === 'price_mod'
        ? action === 'price_mod'
          ? MOCK_AUDIT_ACTORS[4]!
          : pick(rng, MOCK_AUDIT_ACTORS.slice(0, 4))
        : pick(rng, MOCK_AUDIT_ACTORS)

    const drugPool =
      action === 'controlled_dispense' ||
      action === 'controlled_substance_entry'
        ? controlledDrugs
        : allDrugs
    const drug = pick(rng, drugPool)
    const entity = entityForAction(action, drug, rng)
    const payload = buildPayload(action, rng)
    const severity = severityForAction(action, rng)
    const terminal = pick(rng, TERMINALS)
    const isControlled =
      action === 'controlled_dispense' ||
      action === 'controlled_substance_entry' ||
      (drug.isControlled &&
        (action === 'dispensing' ||
          action === 'stock_receipt' ||
          action === 'quarantine'))

    events.push({
      id: padLogId(10000 + events.length),
      timestamp: ts.toISOString(),
      actor,
      action,
      entityType: entity.entityType,
      entityId: entity.entityId,
      entityLabel: entity.entityLabel,
      description: describe(action, drug, entity.entityId),
      severity,
      source: actor.role === 'system' ? 'system' : 'ui',
      before: payload.before,
      after: payload.after,
      ip: terminal.ip,
      terminal: terminal.terminal,
      securityStatus: pick(rng, SECURITY_BY_SEVERITY[severity]),
      isControlledSubstance: Boolean(isControlled),
    })
  }

  // Stable newest-first for the raw catalog (query may re-sort).
  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

/** Fixed-seed catalog relative to MOCK_AUDIT_TODAY. */
export const MOCK_AUDIT_EVENTS: AuditEvent[] = generateMockAuditEvents(
  MOCK_AUDIT_TODAY,
  200,
)

export function computeAuditKpis(
  events: AuditEvent[],
  today: Date = MOCK_AUDIT_TODAY,
): AuditKpis {
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    0,
    0,
    0,
    0,
  )
  const end = start + 86_400_000 - 1
  let todayCount = 0
  let controlledCount = 0
  let failedSecurityCount = 0
  for (const event of events) {
    const ts = new Date(event.timestamp).getTime()
    if (ts >= start && ts <= end) todayCount += 1
    if (event.isControlledSubstance) controlledCount += 1
    if (
      event.action === 'login_failure' ||
      event.action === 'login_lock' ||
      event.severity === 'critical'
    ) {
      // Count failed-auth style security deviations for the KPI card.
      if (event.action === 'login_failure' || event.action === 'login_lock') {
        failedSecurityCount += 1
      }
    }
  }
  return { todayCount, controlledCount, failedSecurityCount }
}

export type GetAuditEventsResult = AuditQueryResult & {
  kpis: AuditKpis
  actors: AuditActor[]
}

/**
 * Async mock accessor supporting filters so a backend can replace later.
 * No network / secrets / .env.
 */
export async function getAuditEvents(
  params: AuditQueryParams = {},
  options?: { today?: Date; fail?: boolean },
): Promise<GetAuditEventsResult> {
  await delay(DELAY_MS)
  if (options?.fail) {
    throw new Error('خطا در دریافت لاگ ممیزی')
  }
  const today = options?.today ?? params.today ?? MOCK_AUDIT_TODAY
  const catalog = generateMockAuditEvents(today, 200)
  const result = applyAuditQuery(catalog, { ...params, today })
  return {
    ...result,
    kpis: computeAuditKpis(catalog, today),
    actors: MOCK_AUDIT_ACTORS,
  }
}
