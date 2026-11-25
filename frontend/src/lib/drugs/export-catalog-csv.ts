import type { Drug } from '@/lib/types/drugs'

function escapeCsv(value: string | number | boolean): string {
  const raw = String(value)
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

/** Client-side UTF-8 BOM CSV of catalog rows (no server export endpoint). */
export function downloadCatalogCsv(rows: Drug[], filename = 'drug-catalog.csv'): void {
  const header = [
    'id',
    'nameFa',
    'brandName',
    'dosageForm',
    'strength',
    'gtin',
    'genericCode',
    'manufacturer',
    'category',
    'isControlled',
    'totalStock',
    'reorderLevel',
    'nearestExpiry',
  ]
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.id,
        row.nameFa,
        row.brandName,
        row.dosageForm,
        row.strength,
        row.gtin,
        row.genericCode,
        row.manufacturer,
        row.category,
        row.isControlled,
        row.totalStock,
        row.reorderLevel,
        row.nearestExpiry,
      ]
        .map(escapeCsv)
        .join(','),
    ),
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
