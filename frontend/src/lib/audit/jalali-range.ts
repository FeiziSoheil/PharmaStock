/**
 * Jalali calendar helpers for audit-log date-range filters.
 * Pure functions; injectable `today` for presets and tests.
 *
 * Gregorian↔Jalali conversion uses the ICU Persian calendar via `Intl`
 * (same source as display formatting) with a binary search for the reverse.
 */

export type JalaliYmd = { year: number; month: number; day: number }

export type UtcDayRange = {
  startIso: string
  endIso: string
}

export type DateRangePreset = 'today' | 'week' | 'month' | 'last30' | 'custom'

export type JalaliRangeInput =
  | { preset: Exclude<DateRangePreset, 'custom'>; today?: Date }
  | {
      preset: 'custom'
      fromJalali: string
      toJalali: string
      today?: Date
    }

export type JalaliRangeResult =
  | { ok: true; range: UtcDayRange; from: JalaliYmd; to: JalaliYmd }
  | { ok: false; error: 'invalid_date' | 'invalid_range' | 'unsupported' }

const JALALI_DATE_RE = /^(\d{3,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/

const persianUtcFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - '٠'.charCodeAt(0)))
}

function readPersianParts(date: Date): JalaliYmd {
  const parts = persianUtcFormatter.formatToParts(date)
  const year = Number(
    toLatinDigits(parts.find((p) => p.type === 'year')?.value ?? ''),
  )
  const month = Number(
    toLatinDigits(parts.find((p) => p.type === 'month')?.value ?? ''),
  )
  const day = Number(
    toLatinDigits(parts.find((p) => p.type === 'day')?.value ?? ''),
  )
  return { year, month, day }
}

function compareJalali(a: JalaliYmd, b: JalaliYmd): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

/** Convert Gregorian Y/M/D (civil UTC) → Jalali Y/M/D. */
export function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number,
): JalaliYmd {
  return readPersianParts(new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0)))
}

/**
 * Convert Jalali Y/M/D → Gregorian Y/M/D by binary-searching UTC midnights
 * until ICU Persian parts match.
 */
export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number,
): { gy: number; gm: number; gd: number } {
  const target: JalaliYmd = { year: jy, month: jm, day: jd }
  let lo = Date.UTC(jy + 621, 0, 1, 12, 0, 0)
  let hi = Date.UTC(jy + 622, 11, 31, 12, 0, 0)

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    // Snap to UTC noon of that civil day
    const probe = new Date(mid)
    const noon = Date.UTC(
      probe.getUTCFullYear(),
      probe.getUTCMonth(),
      probe.getUTCDate(),
      12,
      0,
      0,
    )
    const current = readPersianParts(new Date(noon))
    const cmp = compareJalali(current, target)
    if (cmp === 0) {
      return {
        gy: new Date(noon).getUTCFullYear(),
        gm: new Date(noon).getUTCMonth() + 1,
        gd: new Date(noon).getUTCDate(),
      }
    }
    if (cmp < 0) lo = noon + 86_400_000
    else hi = noon - 86_400_000
  }

  throw new Error(`Unable to convert Jalali ${jy}/${jm}/${jd}`)
}

/** Leap check via day after Esfand 29 (ICU Persian calendar). */
export function isJalaliLeapYear(year: number): boolean {
  const g29 = jalaliToGregorian(year, 12, 29)
  const next = new Date(Date.UTC(g29.gy, g29.gm - 1, g29.gd + 1, 12, 0, 0))
  const j = gregorianToJalali(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  )
  return j.year === year && j.month === 12 && j.day === 30
}

export function jalaliMonthLength(year: number, month: number): number {
  if (month < 1 || month > 12) return 0
  if (month <= 6) return 31
  if (month <= 11) return 30
  return isJalaliLeapYear(year) ? 30 : 29
}

export function parseJalaliDate(input: string): JalaliYmd | null {
  const normalized = toLatinDigits(input.trim())
  const match = JALALI_DATE_RE.exec(normalized)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || year < 1) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  const maxDay = jalaliMonthLength(year, month)
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return null
  return { year, month, day }
}

function startOfUtcDayFromJalali(ymd: JalaliYmd): Date {
  const { gy, gm, gd } = jalaliToGregorian(ymd.year, ymd.month, ymd.day)
  return new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0, 0))
}

function endOfUtcDayFromJalali(ymd: JalaliYmd): Date {
  const { gy, gm, gd } = jalaliToGregorian(ymd.year, ymd.month, ymd.day)
  return new Date(Date.UTC(gy, gm - 1, gd, 23, 59, 59, 999))
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function jalaliFromUtcDate(date: Date): JalaliYmd {
  return gregorianToJalali(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
}

function rangeFromJalaliBounds(
  from: JalaliYmd,
  to: JalaliYmd,
): JalaliRangeResult {
  const start = startOfUtcDayFromJalali(from)
  const end = endOfUtcDayFromJalali(to)
  if (end.getTime() < start.getTime()) {
    return { ok: false, error: 'invalid_range' }
  }
  return {
    ok: true,
    from,
    to,
    range: { startIso: start.toISOString(), endIso: end.toISOString() },
  }
}

export function resolveJalaliDateRange(
  input: JalaliRangeInput,
): JalaliRangeResult {
  const today = input.today ?? new Date()
  const todayJalali = jalaliFromUtcDate(today)

  if (input.preset === 'custom') {
    const from = parseJalaliDate(input.fromJalali)
    const to = parseJalaliDate(input.toJalali)
    if (!from || !to) return { ok: false, error: 'invalid_date' }
    return rangeFromJalaliBounds(from, to)
  }

  if (input.preset === 'today') {
    return rangeFromJalaliBounds(todayJalali, todayJalali)
  }

  if (input.preset === 'week') {
    const startGreg = addUtcDays(startOfUtcDayFromJalali(todayJalali), -6)
    return rangeFromJalaliBounds(jalaliFromUtcDate(startGreg), todayJalali)
  }

  if (input.preset === 'last30') {
    const startGreg = addUtcDays(startOfUtcDayFromJalali(todayJalali), -29)
    return rangeFromJalaliBounds(jalaliFromUtcDate(startGreg), todayJalali)
  }

  if (input.preset === 'month') {
    const from: JalaliYmd = {
      year: todayJalali.year,
      month: todayJalali.month,
      day: 1,
    }
    return rangeFromJalaliBounds(from, todayJalali)
  }

  return { ok: false, error: 'unsupported' }
}

export function formatJalaliYmd(ymd: JalaliYmd): string {
  const mm = String(ymd.month).padStart(2, '0')
  const dd = String(ymd.day).padStart(2, '0')
  return `${ymd.year}/${mm}/${dd}`
}
