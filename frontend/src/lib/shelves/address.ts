/** Physical warehouse address: zone → rack → shelf → bin (e.g. A-03-2-04). */

export type ShelfAddressParts = {
  zone: string
  rack: string
  shelf: string
  bin: string
}

const ADDRESS_RE = /^([A-Za-z]+)-(\d+)-(\d+)-(\d+)$/

/** Build a canonical LTR address string from parts. */
export function formatShelfAddress(parts: ShelfAddressParts): string {
  const rack = parts.rack.padStart(2, '0')
  const bin = parts.bin.padStart(2, '0')
  return `${parts.zone.toUpperCase()}-${rack}-${parts.shelf}-${bin}`
}

/**
 * Parse `A-03-2-04` (or looser spacing / Persian digits) into parts.
 * Returns null when the address does not match zone-rack-shelf-bin.
 */
export function parseShelfAddress(raw: string): ShelfAddressParts | null {
  const normalized = raw
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - '٠'.charCodeAt(0)))
    .replace(/\s+/g, '')
    .toUpperCase()

  const match = ADDRESS_RE.exec(normalized)
  if (!match) return null

  return {
    zone: match[1]!,
    rack: match[2]!,
    shelf: match[3]!,
    bin: match[4]!,
  }
}

/** True when `needle` matches the full address or any hierarchical segment. */
export function addressMatchesQuery(address: string, needle: string): boolean {
  const parsedNeedle = parseShelfAddress(needle)
  if (parsedNeedle) {
    return formatShelfAddress(parsedNeedle) === formatShelfAddress(
      parseShelfAddress(address) ?? { zone: '', rack: '', shelf: '', bin: '' },
    )
  }

  const hay = address.toUpperCase().replace(/\s+/g, '')
  const q = needle.trim().toUpperCase().replace(/\s+/g, '')
  if (!q) return true
  return hay.includes(q)
}
