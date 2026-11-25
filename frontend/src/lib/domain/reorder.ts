/**
 * Auto-reorder suggestion formulas (configurable defaults).
 *
 * - needsReorder: availableStock <= reorderPoint
 * - rawNeed: max(0, targetStock - availableStock - onOrderQuantity)
 * - suggestedQuantity: round rawNeed UP to the nearest packSize multiple
 * - daysOfCover: availableStock / avgDailyUsage
 *     (Infinity when avgDailyUsage <= 0; 0 when availableStock <= 0)
 *
 * availableStock must already exclude expired / unusable batches
 * (see `sumUsableQuantity` in `@/lib/domain/expiry`).
 */

export type ReorderItemInput = {
  availableStock: number
  reorderPoint: number
  targetStock: number
  onOrderQuantity: number
  avgDailyUsage: number
  packSize: number
}

/** Urgency tiers derived from days-of-cover (configurable thresholds). */
export type ReorderUrgency = 'critical' | 'low' | 'reorder' | 'ok'

/** Critical ≤ 2 days, low ≤ 5, reorder ≤ 14, otherwise ok. */
export const URGENCY_THRESHOLDS = {
  critical: 2,
  low: 5,
  reorder: 14,
} as const

export function needsReorder(item: ReorderItemInput): boolean {
  return item.availableStock <= item.reorderPoint
}

/** Round a positive quantity up to the next pack-size multiple. */
export function roundUpToPackSize(quantity: number, packSize: number): number {
  if (quantity <= 0 || packSize <= 0) return 0
  return Math.ceil(quantity / packSize) * packSize
}

/**
 * Suggested order qty = max(0, target − available − onOrder), rounded up to pack size.
 */
export function suggestedQuantity(item: ReorderItemInput): number {
  if (item.packSize <= 0) return 0
  const raw = Math.max(
    0,
    item.targetStock - item.availableStock - item.onOrderQuantity,
  )
  return roundUpToPackSize(raw, item.packSize)
}

/** Days of cover = availableStock / avgDailyUsage (guards zero usage). */
export function daysOfCover(item: ReorderItemInput): number {
  if (item.avgDailyUsage <= 0) return Number.POSITIVE_INFINITY
  if (item.availableStock <= 0) return 0
  return item.availableStock / item.avgDailyUsage
}

export function urgencyFromDaysOfCover(days: number): ReorderUrgency {
  if (!Number.isFinite(days) || days > URGENCY_THRESHOLDS.reorder) return 'ok'
  if (days <= URGENCY_THRESHOLDS.critical) return 'critical'
  if (days <= URGENCY_THRESHOLDS.low) return 'low'
  return 'reorder'
}
