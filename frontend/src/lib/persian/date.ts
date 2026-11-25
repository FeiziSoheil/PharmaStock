import { toPersianDigits } from './text'

const jalaliFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Format an ISO date string as Jalali YYYY/MM/DD with Persian digits. */
export function formatJalaliDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '—'

  const parts = jalaliFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''

  return toPersianDigits(`${year}/${month}/${day}`)
}

/** 24h time HH:MM:SS with Persian digits (local wall clock of the ISO instant). */
export function formatPersianTime(isoDate: string, withMs = false): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '—'
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  if (!withMs) return toPersianDigits(`${hh}:${mm}:${ss}`)
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return toPersianDigits(`${hh}:${mm}:${ss}.${ms}`)
}

/** Days from today until the given ISO date (negative if past). */
export function daysUntil(isoDate: string, now = new Date()): number {
  const target = new Date(isoDate)
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY
  const msPerDay = 24 * 60 * 60 * 1000
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const end = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  return Math.round((end - start) / msPerDay)
}
