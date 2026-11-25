import type { InvoiceReceipt, ReceiptLine, ReceiptTotals } from '@/lib/types/receipts'

export function computeReceiptTotals(
  lines: ReceiptLine[],
  discountRial: number,
  vatRial: number,
): ReceiptTotals {
  const grossRial = lines.reduce((sum, l) => sum + l.quantity * l.buyPriceRial, 0)
  const discount = Math.max(0, discountRial)
  const vat = Math.max(0, vatRial)
  return {
    grossRial,
    discountRial: discount,
    vatRial: vat,
    netRial: grossRial - discount + vat,
  }
}

export function canAdvanceToStep3(lines: ReceiptLine[]): boolean {
  if (lines.length === 0) return false
  return lines.every(
    (l) =>
      Boolean(l.drugId) &&
      Boolean(l.batchNo) &&
      Boolean(l.expiry) &&
      l.quantity > 0 &&
      l.buyPriceRial >= 0,
  )
}

export function canConfirmReceipt(receipt: InvoiceReceipt): boolean {
  if (receipt.status !== 'draft') return false
  if (!canAdvanceToStep3(receipt.lines)) return false
  return receipt.lines.every((l) => Boolean(l.locationLabel?.trim()) || Boolean(l.binId?.trim()))
}
