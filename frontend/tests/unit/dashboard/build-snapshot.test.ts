import { describe, expect, it } from 'vitest'
import {
  buildDashboardSnapshot,
  formatRelativeActivityTime,
  NEAR_EXPIRY_BUCKETS,
} from '@/lib/dashboard/build-snapshot'
import { getExpiryBucket } from '@/lib/domain/expiry'
import type { AuditEvent } from '@/lib/types/audit'
import type { Drug } from '@/lib/types/drugs'
import type { ExpiryBatch } from '@/lib/types/expiry'
import type { ReorderSuggestion } from '@/lib/reorder/reorder-query'

const TODAY = new Date(2026, 10, 11) // 2026-11-11 local calendar

function drug(partial: Partial<Drug> & Pick<Drug, 'id' | 'nameFa'>): Drug {
  return {
    brandName: 'ب',
    dosageForm: 'قرص',
    strength: '۵۰۰',
    gtin: '6260000000000',
    genericCode: 'G1',
    manufacturer: 'م',
    category: 'آنتی‌بیوتیک و ضدباکتری',
    isControlled: false,
    totalStock: 10,
    reorderLevel: 5,
    nearestExpiry: '2027-01-01',
    ...partial,
  }
}

function batch(
  partial: Partial<ExpiryBatch> &
    Pick<ExpiryBatch, 'batchId' | 'drugId' | 'expiry'>,
): ExpiryBatch {
  return {
    nameFa: 'داروی آزمایشی',
    nameEn: 'Test',
    manufacturer: 'م',
    distributor: 'پ',
    invoiceNo: '۱',
    batchNo: 'B-1',
    quantity: 10,
    unitLabel: 'جعبه',
    locationLabel: 'A-01',
    storageNote: 'اتاق',
    zone: 'A',
    category: 'آنتی‌بیوتیک و ضدباکتری',
    isControlled: false,
    status: 'active',
    ...partial,
  }
}

function reorder(
  partial: Partial<ReorderSuggestion> & Pick<ReorderSuggestion, 'id' | 'drugId'>,
): ReorderSuggestion {
  return {
    nameFa: 'دارو',
    dosageForm: 'قرص',
    strength: '۱۰',
    irc: 'IRC-1',
    distributorId: 'hejrat',
    distributorNameFa: 'پخش هجرت',
    distributorNote: '',
    category: 'آنتی‌بیوتیک و ضدباکتری',
    isControlled: false,
    availableStock: 5,
    reorderPoint: 20,
    targetStock: 40,
    onOrderQuantity: 0,
    avgDailyUsage: 2,
    packSize: 1,
    unitCost: 100_000,
    unitLabel: 'جعبه',
    leadTimeDays: 3,
    suggestedQty: 35,
    daysOfCover: 2.5,
    urgency: 'critical',
    locationHint: 'A',
    status: 'active',
    ...partial,
  }
}

function audit(
  partial: Partial<AuditEvent> & Pick<AuditEvent, 'id' | 'timestamp'>,
): AuditEvent {
  return {
    actor: {
      id: 'u1',
      name: 'کاربر',
      role: 'pharmacist',
      initials: 'ک',
    },
    action: 'login_success',
    entityType: 'session',
    entityId: 'sys',
    entityLabel: 'سامانه',
    description: 'رویداد آزمایشی',
    severity: 'info',
    source: 'ui',
    ip: '127.0.0.1',
    terminal: 't1',
    securityStatus: 'recorded',
    isControlledSubstance: false,
    ...partial,
  }
}

describe('buildDashboardSnapshot', () => {
  it('derives KPI near-expiry and expired from the same getExpiryBucket rules', () => {
    const batches = [
      batch({ batchId: 'b-exp', drugId: 'd1', expiry: '2026-10-01' }), // expired
      batch({ batchId: 'b-crit', drugId: 'd1', expiry: '2026-11-20' }), // critical ≤30
      batch({ batchId: 'b-warn', drugId: 'd2', expiry: '2027-01-01' }), // warning ~51d
      batch({ batchId: 'b-watch', drugId: 'd2', expiry: '2027-03-01' }), // watch
      batch({ batchId: 'b-ok', drugId: 'd3', expiry: '2027-12-01' }), // ok
      batch({ batchId: 'b-bad', drugId: 'd3', expiry: 'not-a-date' }),
    ]

    for (const row of batches) {
      const bucket = getExpiryBucket(row.expiry, TODAY)
      if (!bucket) continue
      if (NEAR_EXPIRY_BUCKETS.includes(bucket)) {
        expect(['critical', 'warning']).toContain(bucket)
      }
    }

    const snap = buildDashboardSnapshot({
      today: TODAY,
      drugs: [
        drug({ id: 'd1', nameFa: 'الف', totalStock: 5 }),
        drug({ id: 'd2', nameFa: 'ب', totalStock: 0 }),
        drug({ id: 'd3', nameFa: 'ج', totalStock: 2 }),
      ],
      batches,
      reorderRows: [
        reorder({ id: 'r1', drugId: 'd1', daysOfCover: 1, availableStock: 2 }),
        reorder({
          id: 'r2',
          drugId: 'd3',
          daysOfCover: 5,
          availableStock: 8,
          status: 'order_drafted',
        }),
      ],
      zoneCount: 4,
      shelfCount: 28,
      auditEvents: [],
    })

    expect(snap.kpis.activeDrugCount).toBe(2)
    expect(snap.kpis.activeBatchCount).toBe(6)
    expect(snap.kpis.expiredCount).toBe(1)
    expect(snap.kpis.nearExpiryCount).toBe(2) // critical + warning
    expect(snap.kpis.belowRopCount).toBe(1) // only active
    expect(snap.fefoTiers.find((t) => t.id === 'ok')?.count).toBe(1)
    expect(snap.fefoTiers.find((t) => t.id === 'watch')?.count).toBe(1)
    expect(snap.fefoTiers.find((t) => t.id === 'warning')?.count).toBe(1)
    expect(snap.fefoTiers.find((t) => t.id === 'critical_expired')?.count).toBe(
      2,
    )
  })

  it('sorts FEFO samples by expiry ascending within each tier', () => {
    // Both in warning band (31–90 days from 2026-11-11).
    const batches = [
      batch({
        batchId: 'later',
        drugId: 'd1',
        expiry: '2027-01-20',
        nameFa: 'بعدی',
      }),
      batch({
        batchId: 'sooner',
        drugId: 'd1',
        expiry: '2026-12-20',
        nameFa: 'زودتر',
      }),
    ]
    const snap = buildDashboardSnapshot({
      today: TODAY,
      drugs: [drug({ id: 'd1', nameFa: 'الف' })],
      batches,
      reorderRows: [],
      zoneCount: 1,
      shelfCount: 1,
      auditEvents: [],
      fefoSampleLimit: 3,
    })
    const warning = snap.fefoTiers.find((t) => t.id === 'warning')!
    expect(warning.samples.map((s) => s.batchId)).toEqual(['sooner', 'later'])
  })

  it('limits low-stock preview to active rows sorted by daysOfCover', () => {
    const snap = buildDashboardSnapshot({
      today: TODAY,
      drugs: [],
      batches: [],
      reorderRows: [
        reorder({ id: 'slow', drugId: 'd1', daysOfCover: 9 }),
        reorder({ id: 'fast', drugId: 'd2', daysOfCover: 1 }),
        reorder({
          id: 'draft',
          drugId: 'd3',
          daysOfCover: 0,
          status: 'order_drafted',
        }),
      ],
      zoneCount: 1,
      shelfCount: 1,
      auditEvents: [],
      lowStockLimit: 2,
    })
    expect(snap.lowStock.total).toBe(2)
    expect(snap.lowStock.rows.map((r) => r.id)).toEqual(['fast', 'slow'])
  })

  it('limits activity to newest N events', () => {
    const snap = buildDashboardSnapshot({
      today: TODAY,
      now: new Date('2026-11-11T12:00:00'),
      drugs: [],
      batches: [],
      reorderRows: [],
      zoneCount: 1,
      shelfCount: 1,
      auditEvents: [
        audit({ id: 'a1', timestamp: '2026-11-11T08:00:00' }),
        audit({ id: 'a2', timestamp: '2026-11-11T10:00:00' }),
        audit({ id: 'a3', timestamp: '2026-11-11T09:00:00' }),
        audit({
          id: 'a4',
          timestamp: '2026-11-11T11:00:00',
          severity: 'critical',
        }),
        audit({ id: 'a5', timestamp: '2026-11-10T11:00:00' }),
      ],
      activityLimit: 4,
    })
    expect(snap.activity).toHaveLength(4)
    expect(snap.activity.map((a) => a.id)).toEqual(['a4', 'a2', 'a3', 'a1'])
    expect(snap.activity[0]?.tone).toBe('alert')
  })
})

describe('formatRelativeActivityTime', () => {
  const now = new Date('2026-11-11T12:00:00')

  it('formats minutes and hours in Persian digits', () => {
    expect(formatRelativeActivityTime('2026-11-11T11:25:00', now)).toMatch(
      /دقیقه پیش/,
    )
    expect(formatRelativeActivityTime('2026-11-11T10:00:00', now)).toMatch(
      /ساعت پیش/,
    )
  })

  it('returns em dash for invalid', () => {
    expect(formatRelativeActivityTime('nope', now)).toBe('—')
  })
})
