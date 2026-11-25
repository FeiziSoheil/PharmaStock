export type CardexMovementType =
  | 'inbound'
  | 'outbound'
  | 'transfer'
  | 'adjustment'
  | 'quarantine'

export type CardexMovement = {
  id: string
  drugId: string
  timestampISO: string
  type: CardexMovementType
  batchNo: string
  qtyIn: number
  qtyOut: number
  actorName: string
  shiftLabel: string
  note: string
}
