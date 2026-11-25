import { describe, expect, it } from 'vitest'
import { computeRunningBalances } from '@/lib/drug-details/cardex-balance'

describe('computeRunningBalances', () => {
  it('accumulates in minus out', () => {
    const map = computeRunningBalances([
      { id: 'e1', qtyIn: 100, qtyOut: 0 },
      { id: 'e2', qtyIn: 0, qtyOut: 30 },
      { id: 'e3', qtyIn: 10, qtyOut: 5 },
    ])
    expect(map.get('e1')).toBe(100)
    expect(map.get('e2')).toBe(70)
    expect(map.get('e3')).toBe(75)
  })
})
