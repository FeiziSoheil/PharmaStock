import { describe, expect, it } from 'vitest'
import {
  formatJalaliYmd,
  gregorianToJalali,
  isJalaliLeapYear,
  jalaliMonthLength,
  jalaliToGregorian,
  parseJalaliDate,
  resolveJalaliDateRange,
} from '@/lib/audit/jalali-range'

/** Reference: 2024-11-14 UTC ≈ ۱۴۰۳/۰۸/۲۴ */
const TODAY = new Date(Date.UTC(2024, 10, 14, 12, 0, 0))

describe('jalali conversions', () => {
  it('converts known Gregorian ↔ Jalali pairs', () => {
    const j = gregorianToJalali(2024, 11, 14)
    expect(j).toEqual({ year: 1403, month: 8, day: 24 })

    const g = jalaliToGregorian(1403, 8, 24)
    expect(g).toEqual({ gy: 2024, gm: 11, gd: 14 })
  })

  it('handles Jalali month lengths and leap Esfand', () => {
    expect(jalaliMonthLength(1403, 1)).toBe(31)
    expect(jalaliMonthLength(1403, 7)).toBe(30)
    expect(jalaliMonthLength(1403, 12)).toBe(isJalaliLeapYear(1403) ? 30 : 29)
    expect(jalaliMonthLength(1399, 12)).toBe(30)
    expect(isJalaliLeapYear(1399)).toBe(true)
  })

  it('parses Persian digits and rejects invalid days', () => {
    expect(parseJalaliDate('۱۴۰۳/۰۸/۲۴')).toEqual({
      year: 1403,
      month: 8,
      day: 24,
    })
    expect(parseJalaliDate('1403/12/31')).toBeNull()
    expect(parseJalaliDate('not-a-date')).toBeNull()
  })
})

describe('resolveJalaliDateRange', () => {
  it('resolves today as inclusive single-day UTC range', () => {
    const result = resolveJalaliDateRange({ preset: 'today', today: TODAY })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(formatJalaliYmd(result.from)).toBe('1403/08/24')
    expect(result.range.startIso).toBe('2024-11-14T00:00:00.000Z')
    expect(result.range.endIso).toBe('2024-11-14T23:59:59.999Z')
  })

  it('resolves last 7 days inclusive of today', () => {
    const result = resolveJalaliDateRange({ preset: 'week', today: TODAY })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(formatJalaliYmd(result.to)).toBe('1403/08/24')
    expect(formatJalaliYmd(result.from)).toBe('1403/08/18')
  })

  it('resolves last 30 days preset', () => {
    const result = resolveJalaliDateRange({ preset: 'last30', today: TODAY })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(formatJalaliYmd(result.to)).toBe('1403/08/24')
    expect(result.from.month).toBe(7)
  })

  it('resolves current Jalali month from day 1 through today', () => {
    const result = resolveJalaliDateRange({ preset: 'month', today: TODAY })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.from).toEqual({ year: 1403, month: 8, day: 1 })
    expect(result.to).toEqual({ year: 1403, month: 8, day: 24 })
  })

  it('rejects invalid custom dates and end-before-start', () => {
    expect(
      resolveJalaliDateRange({
        preset: 'custom',
        fromJalali: '1403/13/01',
        toJalali: '1403/08/24',
        today: TODAY,
      }).ok,
    ).toBe(false)

    const inverted = resolveJalaliDateRange({
      preset: 'custom',
      fromJalali: '1403/08/24',
      toJalali: '1403/08/01',
      today: TODAY,
    })
    expect(inverted.ok).toBe(false)
    if (!inverted.ok) expect(inverted.error).toBe('invalid_range')
  })

  it('accepts inclusive custom Jalali range', () => {
    const result = resolveJalaliDateRange({
      preset: 'custom',
      fromJalali: '۱۴۰۳/۰۸/۰۱',
      toJalali: '۱۴۰۳/۰۸/۲۴',
      today: TODAY,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.range.startIso).toBe('2024-10-22T00:00:00.000Z')
    expect(result.range.endIso).toBe('2024-11-14T23:59:59.999Z')
  })
})
