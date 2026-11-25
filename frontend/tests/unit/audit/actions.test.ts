import { describe, expect, it } from 'vitest'
import {
  AUDIT_ACTIONS,
  getAuditActionLabel,
  isAuditActionCode,
  isControlledAuditAction,
  resolveAuditActionCode,
} from '@/lib/domain/auditEvents'

describe('audit actions', () => {
  it('includes backend-emitted shelf/expiry action codes', () => {
    expect(isAuditActionCode('stock_in')).toBe(true)
    expect(isAuditActionCode('stock_transfer')).toBe(true)
    expect(AUDIT_ACTIONS.stock_in.labelFa).toBe('ثبت سری ساخت جدید')
    expect(AUDIT_ACTIONS.stock_transfer.labelFa).toBe('جابجایی قفسه')
  })

  it('resolves unknown codes without throwing', () => {
    expect(resolveAuditActionCode('stock_in')).toBe('stock_in')
    expect(resolveAuditActionCode('ghost_action')).toBe('unknown')
    expect(getAuditActionLabel('ghost_action')).toBe('عملیات نامشخص')
    expect(isControlledAuditAction('ghost_action')).toBe(false)
    expect(isControlledAuditAction('controlled_dispense')).toBe(true)
  })
})
