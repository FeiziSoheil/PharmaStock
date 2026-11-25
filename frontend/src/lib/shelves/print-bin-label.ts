import type { ShelfBin } from '@/lib/types/shelves'

/** Opens a minimal print window for a shelf bin label (client-only). */
export function printShelfBinLabel(bin: ShelfBin): void {
  const batches = bin.batches
    .slice(0, 5)
    .map(
      (b) =>
        `<li>${escapeHtml(b.nameFa)} · ${escapeHtml(b.batchNo)} · ${escapeHtml(b.expiry)} · ${b.quantity}</li>`,
    )
    .join('')
  const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>برچسب ${escapeHtml(bin.address)}</title>
  <style>
    body { font-family: Vazirmatn, Tahoma, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .meta { font-size: 14px; margin-bottom: 16px; }
    ul { padding-inline-start: 18px; margin: 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(bin.address)}</h1>
  <div class="meta">${escapeHtml(bin.zoneLabel)} · ظرفیت ${bin.capacity}${bin.isControlled ? ' · تحت کنترل' : ''}</div>
  <ul>${batches || '<li>بدون موجودی</li>'}</ul>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
  const win = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
