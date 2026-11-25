import { toPersianDigits } from '@/lib/persian'

export function validateOrderQuantity(
  raw: string,
  packSize: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/[۰-۹]/g, (d) =>
    String(d.charCodeAt(0) - '۰'.charCodeAt(0)),
  )
  if (!trimmed) {
    return { ok: false, error: 'تعداد سفارش الزامی است.' }
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: 'تعداد سفارش باید عدد صحیح باشد.' }
  }
  if (value < 0) {
    return { ok: false, error: 'تعداد سفارش نمی‌تواند منفی باشد.' }
  }
  if (packSize > 0 && value % packSize !== 0) {
    return {
      ok: false,
      error: `تعداد باید مضرب ${toPersianDigits(packSize)} (اندازه بسته‌بندی) باشد.`,
    }
  }
  return { ok: true, value }
}
