import {
  AUDIT_SEVERITIES,
  getAuditEntityTypeLabel,
  getAuditSourceLabel,
  getAuditActionLabel,
  getAuditRoleLabel,
} from '@/lib/domain/auditEvents'
import { formatJalaliDate, toPersianDigits } from '@/lib/persian'
import type { AuditEvent } from '@/lib/types/audit'

const CSV_HEADERS = [
  'شناسه لاگ',
  'زمان ISO',
  'تاریخ جلالی',
  'ساعت',
  'عامل',
  'نقش',
  'نوع عملیات',
  'نوع موجودیت',
  'شناسه موجودیت',
  'شرح',
  'شدت',
  'مبدأ',
  'IP',
  'پایانه',
] as const

function formatTimeFa(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return toPersianDigits(`${hh}:${mm}:${ss}`)
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Client-side CSV of the current filtered result. UTF-8 BOM for Persian Excel. */
export function buildAuditCsv(events: AuditEvent[]): string {
  const lines = [
    [...CSV_HEADERS].join(','),
    ...events.map((event) =>
      [
        event.id,
        event.timestamp,
        formatJalaliDate(event.timestamp),
        formatTimeFa(event.timestamp),
        event.actor.name,
        getAuditRoleLabel(event.actor.role),
        getAuditActionLabel(event.action),
        getAuditEntityTypeLabel(event.entityType),
        event.entityId,
        event.description,
        AUDIT_SEVERITIES[event.severity].labelFa,
        getAuditSourceLabel(event.source),
        event.ip,
        event.terminal,
      ]
        .map((cell) => csvEscape(String(cell)))
        .join(','),
    ),
  ]
  return `\uFEFF${lines.join('\n')}`
}

export function downloadAuditCsv(events: AuditEvent[], filename = 'audit-log.csv') {
  const blob = new Blob([buildAuditCsv(events)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Minimal client-side printable HTML used as a PDF export via print dialog. */
export function buildAuditPdfHtml(events: AuditEvent[]): string {
  const rows = events
    .map((event) => {
      return `<tr>
        <td dir="ltr">${event.id}</td>
        <td>${formatJalaliDate(event.timestamp)} ${formatTimeFa(event.timestamp)}</td>
        <td dir="ltr">${event.timestamp}</td>
        <td>${event.actor.name}</td>
        <td>${getAuditActionLabel(event.action)}</td>
        <td dir="ltr">${event.entityId}</td>
        <td>${event.description}</td>
        <td>${AUDIT_SEVERITIES[event.severity].labelFa}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>گزارش ممیزی PharmaStock</title>
  <style>
    body { font-family: Tahoma, sans-serif; padding: 24px; color: #191c1e; }
    h1 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #c5c7c9; padding: 6px; text-align: right; }
    th { background: #eceef0; }
  </style>
</head>
<body>
  <h1>گزارش رسمی ممیزی رویدادها (با سربرگ بازرسی)</h1>
  <p>تعداد رکوردهای فیلترشده: ${toPersianDigits(events.length)}</p>
  <table>
    <thead>
      <tr>
        <th>شناسه</th><th>جلالی</th><th>ISO</th><th>عامل</th>
        <th>عملیات</th><th>موجودیت</th><th>شرح</th><th>شدت</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}

export function downloadAuditPdf(events: AuditEvent[]) {
  const html = buildAuditPdfHtml(events)
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720')
  if (!popup) return
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  popup.print()
}

export function buildAuditJson(events: AuditEvent[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: events.length,
      events: events.map((event) => ({
        id: event.id,
        timestamp: event.timestamp,
        jalaliDate: formatJalaliDate(event.timestamp),
        actor: event.actor.name,
        role: event.actor.role,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        description: event.description,
        severity: event.severity,
        source: event.source,
      })),
    },
    null,
    2,
  )
}

export function downloadAuditJson(events: AuditEvent[], filename = 'audit-log.json') {
  const blob = new Blob([buildAuditJson(events)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
