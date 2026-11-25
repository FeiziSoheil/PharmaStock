import { describe, expect, it } from 'vitest'
import { formatRial } from '@/lib/persian/money'

describe('formatRial', () => {
  it('formats with Persian digits, thousand separators, and ریال', () => {
    expect(formatRial(248_500_000)).toBe('۲۴۸٬۵۰۰٬۰۰۰ ریال')
  })

  it('handles zero and negative values', () => {
    expect(formatRial(0)).toBe('۰ ریال')
    expect(formatRial(-1200)).toBe('‎-۱٬۲۰۰ ریال')
  })

  it('can omit the currency suffix', () => {
    expect(formatRial(345_800_000, { withCurrency: false })).toBe(
      '۳۴۵٬۸۰۰٬۰۰۰',
    )
  })
})
