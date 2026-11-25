import { describe, expect, it } from 'vitest'
import { diffAuditPayloads, summarizeAuditDiff } from '@/lib/audit/diff'

describe('diffAuditPayloads', () => {
  it('flags changed fields and keeps unchanged', () => {
    const fields = diffAuditPayloads(
      { quantity: 25, status: 'آزاد' },
      { quantity: 23, status: 'آزاد' },
    )
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'quantity',
          labelFa: 'موجودی',
          before: '25',
          after: '23',
          changed: true,
        }),
        expect.objectContaining({
          key: 'status',
          changed: false,
        }),
      ]),
    )
  })

  it('summarizes the first changed field for table cells', () => {
    expect(
      summarizeAuditDiff({ location: 'A' }, { location: 'B', note: 'x' }),
    ).toEqual({
      labelFa: 'مکان فیزیکی',
      before: 'A',
      after: 'B',
    })
    expect(summarizeAuditDiff({ a: 1 }, { a: 1 })).toBeNull()
  })

  it('handles missing sides as empty payloads', () => {
    const fields = diffAuditPayloads(undefined, { quantity: 10 })
    expect(fields[0]).toMatchObject({
      before: '—',
      after: '10',
      changed: true,
    })
  })
})
