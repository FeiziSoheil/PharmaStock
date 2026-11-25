import {
  apiCreateControlledEntry,
  apiExportControlledLedger,
  apiListControlledLedger,
  type ControlledLedgerQuery,
} from '@/lib/api/controlled'
import { downloadControlledPdf } from '@/lib/controlled/export'
import type {
  ControlledKpis,
  ControlledLedgerEntry,
  ControlledLedgerListResult,
  CreateControlledEntryInput,
} from '@/lib/types/controlled'

export type { ControlledLedgerQuery }

export async function fetchControlledLedger(
  query: ControlledLedgerQuery = {},
): Promise<ControlledLedgerListResult> {
  return apiListControlledLedger(query)
}

export async function createControlledLedgerEntry(
  input: CreateControlledEntryInput,
): Promise<ControlledLedgerEntry> {
  return apiCreateControlledEntry(input)
}

export async function exportControlledLedgerFile(
  query: ControlledLedgerQuery = {},
  format: 'csv' | 'json' = 'csv',
): Promise<void> {
  const blob = await apiExportControlledLedger(query, format)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `controlled-ledger.${format}`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportControlledLedgerPdf(
  entries: ControlledLedgerEntry[],
  kpis?: ControlledKpis | null,
): void {
  downloadControlledPdf(entries, kpis)
}
