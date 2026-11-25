import { apiExportAuditEvents, apiGetAuditEvents } from '@/lib/api/audit'
import type { AuditQueryParams } from '@/lib/audit/audit-query'
import { downloadAuditPdf } from '@/lib/audit/export'
import type { AuditEvent, GetAuditEventsResult } from '@/lib/types/audit'

export async function fetchAuditEvents(
  params: AuditQueryParams = {},
): Promise<GetAuditEventsResult> {
  return apiGetAuditEvents(params)
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function exportAuditCsv(
  filtered: AuditEvent[],
  params: AuditQueryParams = {},
): Promise<void> {
  const blob = await apiExportAuditEvents(params, 'csv')
  triggerBlobDownload(blob, 'audit-log.csv')
}

export async function exportAuditJson(
  filtered: AuditEvent[],
  params: AuditQueryParams = {},
): Promise<void> {
  const blob = await apiExportAuditEvents(params, 'json')
  triggerBlobDownload(blob, 'audit-log.json')
}

/** PDF remains client print-dialog (backend has no pdf format). */
export function exportAuditPdf(filtered: AuditEvent[]): void {
  downloadAuditPdf(filtered)
}
