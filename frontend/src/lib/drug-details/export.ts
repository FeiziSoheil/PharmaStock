import { formatJalaliDate, toPersianDigits } from '@/lib/persian'
import type { DrugBatchRow, DrugBatchStatus } from '@/lib/drug-details/types'
import type { CardexMovement, CardexMovementType } from '@/lib/types/cardex'

const BATCH_CSV_HEADERS = [
  'شماره سری ساخت',
  'تاریخ تولید ISO',
  'تاریخ تولید جلالی',
  'تاریخ انقضا ISO',
  'تاریخ انقضا جلالی',
  'قیمت خرید (ریال)',
  'قیمت مصرف‌کننده (ریال)',
  'موجودی فیزیکی',
  'واحد',
  'محل در انبار',
  'تأمین‌کننده',
  'وضعیت',
  'شماره فاکتور',
] as const

const STATUS_LABELS: Record<DrugBatchStatus, string> = {
  active: 'فعال',
  quarantine: 'قرنطینه',
  blocked: 'مسدود',
}

const MOVEMENT_TYPE_LABELS: Record<CardexMovementType, string> = {
  inbound: 'ورود',
  outbound: 'خروج',
  transfer: 'جابجایی',
  adjustment: 'اصلاح',
  quarantine: 'قرنطینه',
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Client-side CSV of filtered batches. UTF-8 BOM for Persian Excel. */
export function buildBatchesCsv(rows: DrugBatchRow[]): string {
  const lines = [
    [...BATCH_CSV_HEADERS].join(','),
    ...rows.map((row) =>
      [
        row.batchNo,
        row.productionISO,
        formatJalaliDate(row.productionISO),
        row.expiryISO,
        formatJalaliDate(row.expiryISO),
        String(row.buyPriceRial),
        String(row.consumerPriceRial),
        String(row.quantity),
        row.unitLabel,
        row.locationLabel,
        row.supplierLabel,
        STATUS_LABELS[row.status],
        row.invoiceNo ?? '',
      ]
        .map((cell) => csvEscape(String(cell)))
        .join(','),
    ),
  ]
  return `\uFEFF${lines.join('\n')}`
}

type CardexPrintMovement = CardexMovement & { balance: number }

/** Minimal client-side printable HTML for official cardex print. */
export function buildCardexPrintHtml(
  detail: { nameFa: string },
  movements: CardexPrintMovement[],
): string {
  const rows = movements
    .map((movement) => {
      return `<tr>
        <td>${MOVEMENT_TYPE_LABELS[movement.type]}</td>
        <td>${formatJalaliDate(movement.timestampISO)}</td>
        <td dir="ltr">${movement.batchNo}</td>
        <td>${toPersianDigits(movement.qtyIn)}</td>
        <td>${toPersianDigits(movement.qtyOut)}</td>
        <td>${toPersianDigits(movement.balance)}</td>
        <td>${movement.actorName} / ${movement.shiftLabel}</td>
        <td>${movement.note}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>کاردکس رسمی — ${detail.nameFa}</title>
  <style>
    body { font-family: Tahoma, sans-serif; padding: 24px; color: #191c1e; }
    h1 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #c5c7c9; padding: 6px; text-align: right; }
    th { background: #eceef0; }
  </style>
</head>
<body>
  <h1>کاردکس رسمی انبار — ${detail.nameFa}</h1>
  <p>تعداد رویدادها: ${toPersianDigits(movements.length)}</p>
  <table>
    <thead>
      <tr>
        <th>نوع سند</th><th>تاریخ جلالی</th><th>سری ساخت</th>
        <th>ورود (+)</th><th>خروج (−)</th><th>مانده نهایی انبار</th>
        <th>کاربر / شیفت</th><th>توضیحات</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}

type BarcodeLabelDetail = {
  nameFa: string
  gtin?: string
  brandName?: string
}

/** Printable shelf barcode label HTML for the current drug/location context. */
export function buildBarcodeLabelHtml(
  detail: BarcodeLabelDetail,
  locationHint: string,
): string {
  const gtin = detail.gtin ?? ''
  const brand = detail.brandName ? `<p>${detail.brandName}</p>` : ''

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>برچسب قفسه — ${detail.nameFa}</title>
  <style>
    body { font-family: Tahoma, sans-serif; padding: 24px; color: #191c1e; text-align: center; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    .gtin { font-family: monospace; font-size: 18px; letter-spacing: 0.12em; margin-top: 16px; direction: ltr; }
    .location { font-size: 16px; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>${detail.nameFa}</h1>
  ${brand}
  <p class="location">${locationHint}</p>
  <p class="gtin">${gtin}</p>
</body>
</html>`
}
