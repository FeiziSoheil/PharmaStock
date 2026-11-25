import { MOCK_DRUGS } from './mock-drugs-data'
import { formatShelfAddress } from '@/lib/shelves/address'
import {
  applyShelfQuery,
  type ShelfQueryParams,
  type ShelfQueryResult,
} from '@/lib/shelves/shelf-query'

export const SHELF_ZONES = [
  { id: 'A', label: 'سالن اصلی A (داروهای روتین)' },
  { id: 'B', label: 'سالن B (سرم و حجیم)' },
  { id: 'C', label: 'پیشخوان تحویل نسخه' },
  { id: 'R', label: 'اتاق سرد / زنجیره سرد' },
  { id: 'S', label: 'اتاق حفاظت‌شده (گاوصندوق)' },
] as const

export type ShelfZoneId = (typeof SHELF_ZONES)[number]['id']

export type ShelfBinStatus =
  | 'empty'
  | 'occupied'
  | 'low'
  | 'expiring'
  | 'controlled'

export type ShelfStockStatusFilter = ShelfBinStatus

export type ShelfBatch = {
  drugId: string
  nameFa: string
  batchNo: string
  /** ISO calendar date YYYY-MM-DD */
  expiry: string
  quantity: number
}

export type ShelfBin = {
  id: string
  zone: ShelfZoneId
  zoneLabel: string
  rack: string
  shelf: string
  bin: string
  /** LTR technical address e.g. A-03-2-04 */
  address: string
  isControlled: boolean
  capacity: number
  batches: ShelfBatch[]
  /** Macro location badge label matching Stitch tabs */
  macroLocation: 'main' | 'dispensing' | 'cold' | 'controlled'
}

export type ShelfKpis = {
  capacityPct: number
  occupiedBins: number
  totalBins: number
  emptyBins: number
  dispensingReady: number
  replenishNeeded: number
  coldTempC: number
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function drugById(id: string) {
  const drug = MOCK_DRUGS.find((item) => item.id === id)
  if (!drug) throw new Error(`Missing mock drug ${id}`)
  return drug
}

function batch(
  drugId: string,
  batchNo: string,
  expiry: string,
  quantity: number,
): ShelfBatch {
  const drug = drugById(drugId)
  return {
    drugId,
    nameFa: drug.nameFa,
    batchNo,
    expiry,
    quantity,
  }
}

function makeBin(input: {
  zone: ShelfZoneId
  rack: number
  shelf: number
  bin: number
  isControlled?: boolean
  capacity: number
  batches?: ShelfBatch[]
  macroLocation?: ShelfBin['macroLocation']
}): ShelfBin {
  const zoneMeta = SHELF_ZONES.find((z) => z.id === input.zone)!
  const rack = String(input.rack).padStart(2, '0')
  const shelf = String(input.shelf)
  const bin = String(input.bin).padStart(2, '0')
  const address = formatShelfAddress({
    zone: input.zone,
    rack,
    shelf,
    bin,
  })
  const isControlled = Boolean(input.isControlled || input.zone === 'S')
  const macro =
    input.macroLocation ??
    (input.zone === 'C'
      ? 'dispensing'
      : input.zone === 'R'
        ? 'cold'
        : input.zone === 'S'
          ? 'controlled'
          : 'main')

  return {
    id: `bin-${address}`,
    zone: input.zone,
    zoneLabel: zoneMeta.label,
    rack,
    shelf,
    bin,
    address,
    isControlled,
    capacity: input.capacity,
    batches: input.batches ?? [],
    macroLocation: macro,
  }
}

/**
 * Realistic Persian warehouse bins with mixed occupancy / FEFO / controlled states.
 * Grid layout intent: zones A–B use racks×shelves×bins; C/R/S are smaller maps.
 */
export const MOCK_SHELVES: ShelfBin[] = [
  // Zone A — main hall (4 racks × 3 shelves × 4 bins = 48, trimmed to varied sample)
  makeBin({
    zone: 'A',
    rack: 1,
    shelf: 1,
    bin: 1,
    capacity: 200,
    batches: [batch('d-005', 'ACT-1001', '2027-06-01', 180)],
  }),
  makeBin({
    zone: 'A',
    rack: 1,
    shelf: 1,
    bin: 2,
    capacity: 200,
    batches: [batch('d-001', 'MET-2201', '2026-05-04', 40)],
  }),
  makeBin({ zone: 'A', rack: 1, shelf: 1, bin: 3, capacity: 200, batches: [] }),
  makeBin({
    zone: 'A',
    rack: 1,
    shelf: 1,
    bin: 4,
    capacity: 200,
    batches: [
      batch('d-006', 'B-88402', '2025-11-06', 540),
      batch('d-006', 'B-88499', '2026-08-15', 120),
    ],
  }),
  makeBin({
    zone: 'A',
    rack: 1,
    shelf: 2,
    bin: 1,
    capacity: 150,
    batches: [batch('d-007', 'OMZ-3310', '2026-12-01', 90)],
  }),
  makeBin({
    zone: 'A',
    rack: 1,
    shelf: 2,
    bin: 2,
    capacity: 150,
    batches: [batch('d-008', 'ASA-1190', '2025-12-20', 22)],
  }),
  makeBin({ zone: 'A', rack: 1, shelf: 2, bin: 3, capacity: 150, batches: [] }),
  makeBin({
    zone: 'A',
    rack: 1,
    shelf: 2,
    bin: 4,
    capacity: 150,
    batches: [batch('d-009', 'IBU-5512', '2027-03-10', 110)],
  }),
  makeBin({
    zone: 'A',
    rack: 2,
    shelf: 1,
    bin: 1,
    capacity: 180,
    batches: [batch('d-010', 'LOS-4411', '2026-09-01', 160)],
  }),
  makeBin({
    zone: 'A',
    rack: 2,
    shelf: 1,
    bin: 2,
    capacity: 180,
    batches: [batch('d-011', 'AML-7720', '2025-11-25', 18)],
  }),
  makeBin({
    zone: 'A',
    rack: 2,
    shelf: 1,
    bin: 3,
    capacity: 180,
    batches: [batch('d-012', 'ATR-2099', '2027-01-15', 70)],
  }),
  makeBin({ zone: 'A', rack: 2, shelf: 1, bin: 4, capacity: 180, batches: [] }),
  makeBin({
    zone: 'A',
    rack: 2,
    shelf: 2,
    bin: 1,
    capacity: 120,
    batches: [batch('d-013', 'RAN-3301', '2026-04-22', 25)],
  }),
  makeBin({
    zone: 'A',
    rack: 2,
    shelf: 2,
    bin: 2,
    capacity: 120,
    batches: [batch('d-014', 'CET-8802', '2027-08-08', 95)],
  }),
  makeBin({
    zone: 'A',
    rack: 2,
    shelf: 2,
    bin: 3,
    capacity: 120,
    batches: [batch('d-015', 'DEX-1108', '2025-11-18', 12)],
  }),
  makeBin({
    zone: 'A',
    rack: 2,
    shelf: 2,
    bin: 4,
    capacity: 120,
    batches: [batch('d-017', 'VIT-4400', '2028-01-01', 100)],
  }),
  makeBin({
    zone: 'A',
    rack: 3,
    shelf: 1,
    bin: 1,
    capacity: 200,
    batches: [batch('d-018', 'CLP-2210', '2026-07-07', 150)],
  }),
  makeBin({
    zone: 'A',
    rack: 3,
    shelf: 1,
    bin: 2,
    capacity: 200,
    batches: [batch('d-019', 'MTV-9090', '2026-02-28', 30)],
  }),
  makeBin({ zone: 'A', rack: 3, shelf: 1, bin: 3, capacity: 200, batches: [] }),
  makeBin({
    zone: 'A',
    rack: 3,
    shelf: 1,
    bin: 4,
    capacity: 200,
    batches: [batch('d-020', 'PAN-6677', '2027-05-05', 175)],
  }),
  makeBin({
    zone: 'A',
    rack: 3,
    shelf: 2,
    bin: 1,
    capacity: 160,
    batches: [batch('d-021', 'AZI-3344', '2026-01-10', 48)],
  }),
  makeBin({
    zone: 'A',
    rack: 3,
    shelf: 2,
    bin: 2,
    capacity: 160,
    batches: [batch('d-022', 'CIP-5566', '2027-09-09', 120)],
  }),
  makeBin({
    zone: 'A',
    rack: 3,
    shelf: 2,
    bin: 3,
    capacity: 160,
    batches: [batch('d-023', 'FLU-7788', '2025-12-05', 16)],
  }),
  makeBin({
    zone: 'A',
    rack: 3,
    shelf: 2,
    bin: 4,
    capacity: 160,
    batches: [batch('d-024', 'DOX-1122', '2026-11-11', 88)],
  }),
  makeBin({
    zone: 'A',
    rack: 4,
    shelf: 1,
    bin: 1,
    capacity: 100,
    batches: [batch('d-025', 'PRE-3340', '2027-04-04', 60)],
  }),
  makeBin({
    zone: 'A',
    rack: 4,
    shelf: 1,
    bin: 2,
    capacity: 100,
    batches: [batch('d-026', 'SAL-4450', '2026-06-06', 20)],
  }),
  makeBin({ zone: 'A', rack: 4, shelf: 1, bin: 3, capacity: 100, batches: [] }),
  makeBin({
    zone: 'A',
    rack: 4,
    shelf: 1,
    bin: 4,
    capacity: 100,
    batches: [batch('d-027', 'MON-5560', '2027-07-07', 75)],
  }),
  makeBin({
    zone: 'A',
    rack: 4,
    shelf: 2,
    bin: 1,
    capacity: 100,
    batches: [batch('d-028', 'BUD-6670', '2026-03-03', 14)],
  }),
  makeBin({
    zone: 'A',
    rack: 4,
    shelf: 2,
    bin: 2,
    capacity: 100,
    batches: [batch('d-030', 'FER-7780', '2027-10-10', 90)],
  }),
  makeBin({
    zone: 'A',
    rack: 4,
    shelf: 2,
    bin: 3,
    capacity: 100,
    batches: [batch('d-031', 'CAL-8890', '2028-02-02', 80)],
  }),
  makeBin({
    zone: 'A',
    rack: 4,
    shelf: 2,
    bin: 4,
    capacity: 100,
    batches: [batch('d-032', 'MAG-9901', '2026-08-08', 55)],
  }),

  // Zone B — bulk / IV
  makeBin({
    zone: 'B',
    rack: 8,
    shelf: 1,
    bin: 1,
    capacity: 400,
    batches: [batch('d-035', 'NS-7730', '2027-04-05', 380)],
  }),
  makeBin({
    zone: 'B',
    rack: 8,
    shelf: 1,
    bin: 2,
    capacity: 400,
    batches: [batch('d-036', 'DW-5520', '2026-12-12', 90)],
  }),
  makeBin({ zone: 'B', rack: 8, shelf: 1, bin: 3, capacity: 400, batches: [] }),
  makeBin({
    zone: 'B',
    rack: 8,
    shelf: 1,
    bin: 4,
    capacity: 400,
    batches: [batch('d-035', 'RL-3310', '2025-11-30', 40)],
  }),
  makeBin({
    zone: 'B',
    rack: 8,
    shelf: 2,
    bin: 1,
    capacity: 300,
    batches: [batch('d-036', 'HS-2200', '2027-01-20', 250)],
  }),
  makeBin({
    zone: 'B',
    rack: 8,
    shelf: 2,
    bin: 2,
    capacity: 300,
    batches: [batch('d-002', 'CTX-4410', '2025-12-10', 50)],
  }),

  // Zone C — dispensing counter
  makeBin({
    zone: 'C',
    rack: 1,
    shelf: 1,
    bin: 1,
    capacity: 50,
    macroLocation: 'dispensing',
    batches: [batch('d-005', 'ACT-4412', '2026-04-21', 45)],
  }),
  makeBin({
    zone: 'C',
    rack: 1,
    shelf: 1,
    bin: 2,
    capacity: 50,
    macroLocation: 'dispensing',
    batches: [batch('d-006', 'AMX-2200', '2026-09-09', 8)],
  }),
  makeBin({
    zone: 'C',
    rack: 1,
    shelf: 1,
    bin: 3,
    capacity: 40,
    macroLocation: 'dispensing',
    batches: [],
  }),
  makeBin({
    zone: 'C',
    rack: 1,
    shelf: 1,
    bin: 4,
    capacity: 40,
    macroLocation: 'dispensing',
    batches: [batch('d-009', 'IBU-1001', '2027-02-02', 30)],
  }),
  makeBin({
    zone: 'C',
    rack: 1,
    shelf: 2,
    bin: 1,
    capacity: 40,
    macroLocation: 'dispensing',
    batches: [batch('d-001', 'MET-0909', '2026-05-04', 12)],
  }),
  makeBin({
    zone: 'C',
    rack: 1,
    shelf: 2,
    bin: 2,
    capacity: 40,
    macroLocation: 'dispensing',
    batches: [batch('d-014', 'CET-0707', '2025-11-22', 6)],
  }),

  // Zone R — cold chain
  makeBin({
    zone: 'R',
    rack: 1,
    shelf: 1,
    bin: 1,
    capacity: 100,
    macroLocation: 'cold',
    batches: [
      batch('d-003', 'LAN-9021', '2025-11-10', 85),
      batch('d-003', 'LAN-9100', '2026-06-01', 40),
    ],
  }),
  makeBin({
    zone: 'R',
    rack: 1,
    shelf: 1,
    bin: 2,
    capacity: 80,
    macroLocation: 'cold',
    batches: [batch('d-031', 'INS-3300', '2026-01-15', 20)],
  }),
  makeBin({
    zone: 'R',
    rack: 1,
    shelf: 1,
    bin: 3,
    capacity: 80,
    macroLocation: 'cold',
    batches: [],
  }),
  makeBin({
    zone: 'R',
    rack: 1,
    shelf: 2,
    bin: 1,
    capacity: 60,
    macroLocation: 'cold',
    batches: [batch('d-032', 'GLC-1100', '2025-12-01', 15)],
  }),
  makeBin({
    zone: 'R',
    rack: 1,
    shelf: 2,
    bin: 2,
    capacity: 60,
    macroLocation: 'cold',
    batches: [batch('d-003', 'LAN-2200', '2027-03-03', 48)],
  }),

  // Zone S — controlled safe
  makeBin({
    zone: 'S',
    rack: 1,
    shelf: 1,
    bin: 1,
    isControlled: true,
    capacity: 50,
    macroLocation: 'controlled',
    batches: [batch('d-004', 'MRP-1109', '2026-12-21', 120)],
  }),
  makeBin({
    zone: 'S',
    rack: 1,
    shelf: 1,
    bin: 2,
    isControlled: true,
    capacity: 40,
    macroLocation: 'controlled',
    batches: [batch('d-015', 'ALP-2201', '2027-05-05', 24)],
  }),
  makeBin({
    zone: 'S',
    rack: 1,
    shelf: 1,
    bin: 3,
    isControlled: true,
    capacity: 40,
    macroLocation: 'controlled',
    batches: [],
  }),
  makeBin({
    zone: 'S',
    rack: 1,
    shelf: 2,
    bin: 1,
    isControlled: true,
    capacity: 30,
    macroLocation: 'controlled',
    batches: [batch('d-037', 'FEN-3302', '2026-08-08', 18)],
  }),
  makeBin({
    zone: 'S',
    rack: 1,
    shelf: 2,
    bin: 2,
    isControlled: true,
    capacity: 30,
    macroLocation: 'controlled',
    batches: [batch('d-042', 'TRA-4403', '2025-11-28', 10)],
  }),
]

export function computeShelfKpis(bins: ShelfBin[] = MOCK_SHELVES): ShelfKpis {
  const totalBins = bins.length
  const emptyBins = bins.filter((b) => b.batches.length === 0).length
  const occupiedBins = totalBins - emptyBins
  const capacityPct =
    totalBins === 0 ? 0 : Math.round((occupiedBins / totalBins) * 100)
  const dispensingReady = bins
    .filter((b) => b.macroLocation === 'dispensing')
    .reduce((sum, b) => sum + b.batches.reduce((q, bat) => q + bat.quantity, 0), 0)
  const replenishNeeded = bins.filter((b) => {
    if (b.macroLocation !== 'dispensing') return false
    const qty = b.batches.reduce((q, bat) => q + bat.quantity, 0)
    return qty > 0 && qty < b.capacity * 0.3
  }).length

  return {
    capacityPct,
    occupiedBins,
    totalBins,
    emptyBins,
    dispensingReady,
    replenishNeeded,
    coldTempC: 4.2,
  }
}

/** Async mock accessor — replaceable by a real API later. */
export async function getShelves(
  params: ShelfQueryParams = {},
): Promise<ShelfQueryResult & { kpis: ShelfKpis }> {
  await delay(220)
  const result = applyShelfQuery(MOCK_SHELVES, params)
  return { ...result, kpis: computeShelfKpis(MOCK_SHELVES) }
}

export async function getShelfById(id: string): Promise<ShelfBin | null> {
  await delay(80)
  return MOCK_SHELVES.find((bin) => bin.id === id) ?? null
}

export const FIXTURE_SHELVES = MOCK_SHELVES
