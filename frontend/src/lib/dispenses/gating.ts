import type { DispenseLine, DispenseOrder, DispenseTotals } from '@/lib/types/dispenses'

export function computeDispenseTotals(order: Pick<DispenseOrder, 'lines' | 'fees'>): DispenseTotals {
  const goodsTotal = order.lines.reduce((sum, l) => sum + l.quantity * l.consumerPrice, 0)
  const technicalFee = order.fees.technicalFee
  const insuranceCover = order.fees.insuranceCover
  const patientPayable = Math.max(0, goodsTotal + technicalFee - insuranceCover)
  return {
    goodsTotal,
    technicalFee,
    insuranceCover,
    patientPayable,
    lineCount: order.lines.length,
    coldCount: order.lines.filter((l) => l.isColdChain).length,
    controlledCount: order.lines.filter((l) => l.isControlled).length,
  }
}

function controlledOk(line: DispenseLine): boolean {
  if (!line.isControlled) return true
  const c = line.controlled
  if (!c) return false
  return (
    c.physicianName.trim() !== '' &&
    c.recipientNationalId.trim() !== '' &&
    c.eRxTrackingId.trim() !== '' &&
    c.technicalAck === true
  )
}

export function canConfirmDispense(order: DispenseOrder): boolean {
  if (order.status !== 'draft') return false
  if (order.patient.nameFa.trim() === '') return false
  if (order.lines.length === 0) return false
  for (const line of order.lines) {
    if (line.quantity <= 0) return false
    if (line.allocation === 'manual' && !line.manualReason?.trim()) return false
    if (!controlledOk(line)) return false
  }
  return true
}
