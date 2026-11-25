export type CardexBalanceEvent = {
  id: string
  qtyIn: number
  qtyOut: number
}

/** Running stock after each event. Input must be chronological oldest→newest. */
export function computeRunningBalances(
  events: CardexBalanceEvent[],
): Map<string, number> {
  const balances = new Map<string, number>()
  let balance = 0
  for (const event of events) {
    balance += event.qtyIn - event.qtyOut
    balances.set(event.id, balance)
  }
  return balances
}
