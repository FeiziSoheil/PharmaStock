import { describe, expect, it } from 'vitest'
import {
  AUDIT_ROLES,
  getAuditRoleLabel,
  isAuditRole,
  resolveAuditRole,
} from '@/lib/domain/auditEvents'

describe('audit roles', () => {
  it('recognizes seeded backend roles used by live actors', () => {
    expect(isAuditRole('warehouse_operator')).toBe(true)
    expect(isAuditRole('super_admin')).toBe(true)
    expect(isAuditRole('dispensing_clerk')).toBe(true)
    expect(isAuditRole('unknown')).toBe(true)
    expect(AUDIT_ROLES.warehouse_operator.labelFa).toBe('اپراتور انبار')
    expect(AUDIT_ROLES.super_admin.labelFa).toBe('مدیر سامانه / مؤسس')
    expect(AUDIT_ROLES.unknown.labelFa).toBe('نامشخص')
  })

  it('resolves backend roles without throwing and falls back safely', () => {
    expect(resolveAuditRole('warehouse_operator')).toBe('warehouse_operator')
    expect(resolveAuditRole('unknown')).toBe('unknown')
    expect(resolveAuditRole('ghost_role')).toBe('unknown')
    expect(getAuditRoleLabel('warehouse_operator')).toBe('اپراتور انبار')
    expect(getAuditRoleLabel('ghost_role')).toBe('نامشخص')
  })
})
