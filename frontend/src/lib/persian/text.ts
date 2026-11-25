const ARABIC_YEH = /\u064A/g
const ARABIC_KAF = /\u0643/g
const PERSIAN_DIGITS = /[۰-۹]/g
const ARABIC_DIGITS = /[٠-٩]/g

const PERSIAN_DIGIT_MAP = '۰۱۲۳۴۵۶۷۸۹'

/** Normalize Persian/Arabic letters and digits for search comparison. */
export function normalizePersianText(input: string): string {
  return input
    .normalize('NFC')
    .replace(ARABIC_YEH, 'ی')
    .replace(ARABIC_KAF, 'ک')
    .replace(PERSIAN_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - '۰'.charCodeAt(0)),
    )
    .replace(ARABIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - '٠'.charCodeAt(0)),
    )
    .toLowerCase()
    .trim()
}

/** Convert Latin digits in a string to Persian digits. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGIT_MAP[Number(digit)]!)
}

/** Format a number with Persian digits and fa-IR grouping. */
export function formatPersianNumber(value: number): string {
  return value.toLocaleString('fa-IR')
}
