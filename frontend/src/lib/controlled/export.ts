import { formatJalaliDate, formatPersianTime, toPersianDigits } from '@/lib/persian'
import type { ControlledKpis, ControlledLedgerEntry } from '@/lib/types/controlled'

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build printable official inspection PDF HTML matching Ministry of Health ledger layout. */
export function buildControlledPdfHtml(
  entries: ControlledLedgerEntry[],
  kpis?: ControlledKpis | null,
): string {
  const rows = entries
    .map((entry) => {
      const seq = toPersianDigits(String(entry.seqNo).padStart(2, '0'))
      const jalali = formatJalaliDate(entry.timestamp)
      const clock = formatPersianTime(entry.timestamp)
      const inText = entry.qtyIn > 0 ? `+${toPersianDigits(entry.qtyIn)}` : '—'
      const outText =
        entry.qtyOut > 0
          ? `-${toPersianDigits(entry.qtyOut)}`
          : entry.ampouleWasteCount > 0
            ? `پوکه ${toPersianDigits(entry.ampouleWasteCount)}`
            : '—'
      return `<tr>
        <td>${seq}</td>
        <td>${jalali}<br/><small>${clock}</small></td>
        <td>${escapeHtml(entry.drugNameFa)}<br/><small>${escapeHtml(entry.dosageStrength ?? '')}</small></td>
        <td dir="ltr">${escapeHtml(entry.batchNo)}</td>
        <td>${escapeHtml(entry.txSubLabel)}</td>
        <td>${inText}</td>
        <td>${outText}</td>
        <td>${toPersianDigits(entry.balanceAfter)} ${escapeHtml(entry.unitLabel)}</td>
        <td>${escapeHtml(entry.physicianName ?? '—')}</td>
        <td dir="ltr">${escapeHtml(entry.patientNationalIdMasked ?? '—')}</td>
        <td dir="ltr">${escapeHtml(entry.trackingCode)}</td>
        <td>${escapeHtml(entry.signedBy.name)}</td>
      </tr>`
    })
    .join('')

  const vaultSummary = kpis
    ? `موجودی کل گاوصندوق: ${toPersianDigits(kpis.totalVaultBalance)} واحد | ورودی ۳۰ روز: +${toPersianDigits(kpis.monthInflow)} | خروجی ۳۰ روز: -${toPersianDigits(kpis.monthOutflow)} | پوکه امحاشده: ${toPersianDigits(kpis.wasteDestroyedCount)}`
    : ''

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>گزارش رسمی دفترچه داروهای تحت کنترل و مخدر | PharmaStock</title>
  <style>
    body { font-family: Tahoma, Vazirmatn, sans-serif; padding: 24px; color: #191c1e; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #3e4947; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #bdc9c6; padding: 6px; text-align: right; vertical-align: top; }
    th { background: #eceef0; font-weight: 700; }
    small { color: #6e7977; font-size: 10px; }
  </style>
</head>
<body>
  <h1>دفترچه رسمی گردش فرآورده‌های تحت کنترل و مخدر — گزارش بازرسی معاونت غذا و دارو</h1>
  <div class="meta">
    <div>شناسه دفترچه سپاس: ۹۸۲۴/م‌خ/۱۴۰۳ · تعداد ردیف‌های گزارش: ${toPersianDigits(entries.length)}</div>
    ${vaultSummary ? `<div>${vaultSummary}</div>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>ردیف</th>
        <th>زمان ثبت شمسی</th>
        <th>فرآورده و دوز</th>
        <th>سری ساخت</th>
        <th>نوع گردش</th>
        <th>ورود (+)</th>
        <th>خروج (-)</th>
        <th>مانده گاوصندوق</th>
        <th>پزشک / پخش</th>
        <th>کدملی</th>
        <th>شناسه TTAC / سپاس</th>
        <th>تایید مسئول فنی</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}

export function downloadControlledPdf(
  entries: ControlledLedgerEntry[],
  kpis?: ControlledKpis | null,
) {
  const html = buildControlledPdfHtml(entries, kpis)
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=760')
  if (!popup) return
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  popup.print()
}
