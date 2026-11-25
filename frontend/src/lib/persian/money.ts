import { toPersianDigits } from './text'

export type FormatRialOptions = {
  /** Append « ریال» (default true). */
  withCurrency?: boolean
}

/**
 * Shared Rial money formatter: Persian digits + fa-IR thousand separators.
 */
export function formatRial(
  value: number,
  options: FormatRialOptions = {},
): string {
  const withCurrency = options.withCurrency !== false
  const rounded = Math.trunc(value)
  const formatted = rounded.toLocaleString('fa-IR')
  // Normalize ASCII/Unicode minus (and locale LRM) to a consistent LRM + ASCII hyphen.
  const normalized = formatted
    .replace(/^\u200e?[-\u2212]/, '\u200e-')
  const amount = toPersianDigits(normalized)
  return withCurrency ? `${amount} ریال` : amount
}
