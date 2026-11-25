import { describe, expect, it } from 'vitest'
import {
  addressMatchesQuery,
  formatShelfAddress,
  parseShelfAddress,
} from '@/lib/shelves/address'

describe('shelf address parsing', () => {
  it('formats zone-rack-shelf-bin with zero-padded rack/bin', () => {
    expect(
      formatShelfAddress({ zone: 'a', rack: '3', shelf: '2', bin: '4' }),
    ).toBe('A-03-2-04')
  })

  it('parses canonical and Persian-digit addresses', () => {
    expect(parseShelfAddress('A-03-2-04')).toEqual({
      zone: 'A',
      rack: '03',
      shelf: '2',
      bin: '04',
    })
    expect(parseShelfAddress('a-۳-۲-۴')).toEqual({
      zone: 'A',
      rack: '3',
      shelf: '2',
      bin: '4',
    })
    expect(parseShelfAddress('not-an-address')).toBeNull()
  })

  it('matches full address and partial segment queries', () => {
    expect(addressMatchesQuery('A-03-2-04', 'A-03-2-04')).toBe(true)
    expect(addressMatchesQuery('A-03-2-04', 'A-03')).toBe(true)
    expect(addressMatchesQuery('A-03-2-04', 'B-01')).toBe(false)
  })
})
