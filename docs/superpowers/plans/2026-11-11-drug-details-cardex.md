# Drug Details & Cardex (`drug-details-cardex`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase G Screen 7 — `/drug-details-cardex` — matching Stitch, wired from catalog, with session-local batch/catalog mutations and a dual cardex view (table + `KardexTimeline`).

**Architecture:** Flat Next.js App Router page with URL-driven state (`drugId`, `tab`, filters, pagination). Async mock DAL aggregates `MOCK_DRUGS` + batch rows + cardex movements in an in-module mutable store. Pure helpers in `src/lib/drug-details/` (URL, filter, FEFO rank, balance, validation, export). UI composes existing design-system only; stop on Needed components.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 tokens, Vitest, Playwright, existing PharmaStock DS (`AppShell`, `Tabs`, `DenseDataTable`, `SideDrawer`, `ConfirmDialog`, `KpiMetricCard`, `KardexTimeline`, `sonner`).

**Spec:** `docs/superpowers/specs/2026-11-11-drug-details-cardex-design.md`  
**Visual SoT:** `docs/stitch-reference/screens/drug-details-cardex/`

## Global Constraints

- App code only under `02-project/app/`.
- Persian main headings; Persian digits; Jalali dates; tabular numerals; logical CSS; light theme only.
- No API calls, secrets, `.env`, or realistic credentials in payloads.
- No one-off page-local components; DS-only composition.
- Implement Stitch controls + agreed `KardexTimeline` on cardex tab only; no invented chrome.
- Missing/insufficient DS control → list Needed components and STOP.
- Do not edit `README.md`, `BRIEF.md`, `templates/`, or `tools/export-agent-logs.py`.
- Session-local mutations: survive client navigations; lost on full reload.
- Stop after this screen; do not start other screens in the same delivery.
- Working directory for commands: `02-project/app` unless noted.
- Test runner: `pnpm test` (vitest), e2e: `PLAYWRIGHT_PORT=<free> pnpm exec playwright test tests/e2e/drug-details-cardex.spec.ts`.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/drug-details/types.ts` | Shared typed models for detail page (batch status, tabs, filters) |
| `src/lib/drug-details/url-state.ts` | Parse/serialize URL query |
| `src/lib/drug-details/batch-query.ts` | Filter/search/FEFO rank/paginate batches; KPI derivation |
| `src/lib/drug-details/cardex-balance.ts` | Pure running-balance helper |
| `src/lib/drug-details/validation.ts` | Persian validation for add-batch / edit-catalog / move-shelf forms |
| `src/lib/drug-details/export.ts` | CSV (UTF-8 BOM) + printable HTML helpers |
| `src/lib/mock/drugDetails.ts` | Detail profile extensions + batch store + DAL + mutations |
| `src/lib/mock/cardex.ts` | Seeded cardex movements + append API used by DAL |
| `src/app/drug-details-cardex/page.tsx` | Suspense shell + metadata |
| `src/app/drug-details-cardex/nav.ts` | Active nav key for AppShell |
| `src/app/drug-details-cardex/drug-details-view.tsx` | Main client view |
| `src/app/drug-catalog/drug-catalog-view.tsx` | Real links to detail |
| `src/app/page.tsx` | Home link (if pattern continues) |
| `tests/unit/drug-details/*.test.ts` | Unit tests |
| `tests/e2e/drug-details-cardex.spec.ts` | Playwright |
| `docs/design-system/PROGRESS.md` | Append Screen 7 section |
| `02-project/images/h13-drug-details-{desktop,tablet,mobile}.png` | Screenshots from e2e |

---

### Task 1: URL state helpers (TDD)

**Files:**
- Create: `src/lib/drug-details/types.ts`
- Create: `src/lib/drug-details/url-state.ts`
- Test: `tests/unit/drug-details/url-state.test.ts`

**Interfaces:**
- Produces:
  - `DrugDetailsTab = 'batches' | 'cardex' | 'info'`
  - `BatchFilter = 'all' | 'in-stock' | 'expiring' | 'quarantine'`
  - `DrugDetailsUrlState = { drugId: string; tab: DrugDetailsTab; batchFilter: BatchFilter; q: string; page: number; pageSize: number }`
  - `DEFAULT_DRUG_DETAILS_URL_STATE`, `DRUG_DETAILS_PAGE_SIZES = [10, 25, 50] as const`
  - `parseDrugDetailsUrlState(params: URLSearchParams): DrugDetailsUrlState`
  - `serializeDrugDetailsUrlState(state: DrugDetailsUrlState): URLSearchParams`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DRUG_DETAILS_URL_STATE,
  parseDrugDetailsUrlState,
  serializeDrugDetailsUrlState,
} from '@/lib/drug-details/url-state'

describe('parseDrugDetailsUrlState', () => {
  it('returns defaults for empty params', () => {
    expect(parseDrugDetailsUrlState(new URLSearchParams())).toEqual(
      DEFAULT_DRUG_DETAILS_URL_STATE,
    )
  })

  it('parses valid drugId, tab, filter, q, page, pageSize', () => {
    const params = new URLSearchParams({
      drugId: 'd-001',
      tab: 'cardex',
      batchFilter: 'expiring',
      q: 'M9041',
      page: '2',
      pageSize: '25',
    })
    expect(parseDrugDetailsUrlState(params)).toEqual({
      drugId: 'd-001',
      tab: 'cardex',
      batchFilter: 'expiring',
      q: 'M9041',
      page: 2,
      pageSize: 25,
    })
  })

  it('falls back invalid tab/filter/pageSize', () => {
    const params = new URLSearchParams({
      tab: 'nope',
      batchFilter: 'xyz',
      page: '0',
      pageSize: '99',
    })
    const state = parseDrugDetailsUrlState(params)
    expect(state.tab).toBe('batches')
    expect(state.batchFilter).toBe('all')
    expect(state.page).toBe(1)
    expect(state.pageSize).toBe(10)
  })
})

describe('serializeDrugDetailsUrlState', () => {
  it('round-trips non-default fields and omits empty drugId/q when empty', () => {
    const state = {
      drugId: 'd-002',
      tab: 'info' as const,
      batchFilter: 'quarantine' as const,
      q: '',
      page: 1,
      pageSize: 10,
    }
    const params = serializeDrugDetailsUrlState(state)
    expect(params.get('drugId')).toBe('d-002')
    expect(params.get('tab')).toBe('info')
    expect(params.get('batchFilter')).toBe('quarantine')
    expect(params.get('q')).toBeNull()
    expect(parseDrugDetailsUrlState(params).drugId).toBe('d-002')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm test tests/unit/drug-details/url-state.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement types + url-state**

```ts
// src/lib/drug-details/types.ts
export type DrugDetailsTab = 'batches' | 'cardex' | 'info'
export type BatchFilter = 'all' | 'in-stock' | 'expiring' | 'quarantine'

export type DrugBatchStatus = 'active' | 'quarantine' | 'blocked'

export type DrugDetailsUrlState = {
  drugId: string
  tab: DrugDetailsTab
  batchFilter: BatchFilter
  q: string
  page: number
  pageSize: number
}
```

```ts
// src/lib/drug-details/url-state.ts
import type { BatchFilter, DrugDetailsTab, DrugDetailsUrlState } from './types'

export const DRUG_DETAILS_PAGE_SIZES = [10, 25, 50] as const

export const DEFAULT_DRUG_DETAILS_URL_STATE: DrugDetailsUrlState = {
  drugId: '',
  tab: 'batches',
  batchFilter: 'all',
  q: '',
  page: 1,
  pageSize: 10,
}

const TABS: DrugDetailsTab[] = ['batches', 'cardex', 'info']
const FILTERS: BatchFilter[] = ['all', 'in-stock', 'expiring', 'quarantine']

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.floor(n)
}

export function parseDrugDetailsUrlState(params: URLSearchParams): DrugDetailsUrlState {
  const tabRaw = params.get('tab') ?? ''
  const filterRaw = params.get('batchFilter') ?? ''
  const pageSize = parsePositiveInt(params.get('pageSize'), DEFAULT_DRUG_DETAILS_URL_STATE.pageSize)
  return {
    drugId: (params.get('drugId') ?? '').trim(),
    tab: (TABS as string[]).includes(tabRaw) ? (tabRaw as DrugDetailsTab) : 'batches',
    batchFilter: (FILTERS as string[]).includes(filterRaw)
      ? (filterRaw as BatchFilter)
      : 'all',
    q: (params.get('q') ?? '').trim(),
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: (DRUG_DETAILS_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_DRUG_DETAILS_URL_STATE.pageSize,
  }
}

export function serializeDrugDetailsUrlState(state: DrugDetailsUrlState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.drugId) params.set('drugId', state.drugId)
  if (state.tab !== DEFAULT_DRUG_DETAILS_URL_STATE.tab) params.set('tab', state.tab)
  if (state.batchFilter !== DEFAULT_DRUG_DETAILS_URL_STATE.batchFilter) {
    params.set('batchFilter', state.batchFilter)
  }
  if (state.q) params.set('q', state.q)
  if (state.page !== 1) params.set('page', String(state.page))
  if (state.pageSize !== DEFAULT_DRUG_DETAILS_URL_STATE.pageSize) {
    params.set('pageSize', String(state.pageSize))
  }
  return params
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm test tests/unit/drug-details/url-state.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/drug-details/types.ts src/lib/drug-details/url-state.ts tests/unit/drug-details/url-state.test.ts
git commit -m "feat(drug-details): add URL state helpers for cardex screen"
```

---

### Task 2: Batch filter, FEFO rank, KPIs (TDD)

**Files:**
- Create: `src/lib/drug-details/batch-query.ts`
- Test: `tests/unit/drug-details/batch-query.test.ts`

**Interfaces:**
- Consumes: `BatchFilter` from types; `getExpiryBucket` / day math from `@/lib/domain/expiry`
- Produces:
  - `DrugBatchRow` type used by query (or import from mock once Task 4 exists — for Task 2 define a minimal local shape in the helper file / types)
  - `applyBatchQuery(rows, { batchFilter, q, page, pageSize, todayISO }): { rows, total, fefoPriorityIds: string[], kpis }`
  - `rankFefo(rows, todayISO): string[]` — batch ids nearest-expiry first among active+qty>0 non-quarantine

Define `DrugBatchRow` in `types.ts`:

```ts
export type DrugBatchRow = {
  id: string
  drugId: string
  batchNo: string
  productionISO: string
  expiryISO: string
  buyPriceRial: number
  consumerPriceRial: number
  quantity: number
  unitLabel: string
  locationLabel: string
  supplierLabel: string
  status: DrugBatchStatus
  invoiceNo?: string
}
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { applyBatchQuery, rankFefo } from '@/lib/drug-details/batch-query'
import type { DrugBatchRow } from '@/lib/drug-details/types'

const TODAY = '2026-11-11'

const rows: DrugBatchRow[] = [
  {
    id: 'b1',
    drugId: 'd-001',
    batchNo: 'M9041',
    productionISO: '2022-11-06',
    expiryISO: '2025-05-05',
    buyPriceRial: 120000,
    consumerPriceRial: 150000,
    quantity: 450,
    unitLabel: 'جعبه',
    locationLabel: 'قفسه A-12',
    supplierLabel: 'پخش هجرت',
    status: 'active',
  },
  {
    id: 'b2',
    drugId: 'd-001',
    batchNo: 'M9100',
    productionISO: '2024-01-01',
    expiryISO: '2027-01-01',
    buyPriceRial: 100000,
    consumerPriceRial: 130000,
    quantity: 0,
    unitLabel: 'جعبه',
    locationLabel: 'قفسه B-1',
    supplierLabel: 'داروپخش',
    status: 'active',
  },
  {
    id: 'b3',
    drugId: 'd-001',
    batchNo: 'Q1',
    productionISO: '2023-01-01',
    expiryISO: '2026-01-01',
    buyPriceRial: 110000,
    consumerPriceRial: 140000,
    quantity: 10,
    unitLabel: 'جعبه',
    locationLabel: 'قرنطینه',
    supplierLabel: 'داروپخش',
    status: 'quarantine',
  },
]

describe('rankFefo', () => {
  it('orders active in-stock by nearest expiry and skips quarantine/zero', () => {
    expect(rankFefo(rows, TODAY)).toEqual(['b1'])
  })
})

describe('applyBatchQuery', () => {
  it('filters in-stock', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'in-stock',
      q: '',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.total).toBe(2) // b1 + b3 still has qty; decide: quarantine still "in-stock" if qty>0
    // Spec chips: دارای موجودی = quantity > 0 (include quarantine)
    expect(result.rows.map((r) => r.id).sort()).toEqual(['b1', 'b3'])
  })

  it('filters quarantine', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'quarantine',
      q: '',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.rows.map((r) => r.id)).toEqual(['b3'])
  })

  it('searches batchNo case-insensitively', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'all',
      q: 'm9041',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.rows.map((r) => r.id)).toEqual(['b1'])
  })

  it('computes dispensable KPI excluding quarantine', () => {
    const result = applyBatchQuery(rows, {
      batchFilter: 'all',
      q: '',
      page: 1,
      pageSize: 10,
      todayISO: TODAY,
    })
    expect(result.kpis.dispensableQty).toBe(450)
    expect(result.kpis.fefoBatchNo).toBe('M9041')
  })
})
```

Clarify in implementation: **in-stock** = `quantity > 0`; **quarantine** = `status === 'quarantine' || status === 'blocked'`; **expiring** = active, qty>0, and expiry bucket in `expired|critical|warning|watch` (≤180 days) using `getExpiryBucket`.

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test tests/unit/drug-details/batch-query.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `batch-query.ts`**

Implement `marginPercent(buy, consumer)`, `rankFefo`, `applyBatchQuery` with KPIs:

```ts
export type BatchKpis = {
  dispensableQty: number
  activeBatchCount: number
  quarantineBatchCount: number
  fefoBatchNo: string | null
  fefoExpiryISO: string | null
  totalQty: number
}
```

`fefoPriorityIds` = `rankFefo` result; first id is priority 1. Paginate after filter/search; default sort = FEFO order for active in-stock, then others by expiry ascending.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/drug-details/types.ts src/lib/drug-details/batch-query.ts tests/unit/drug-details/batch-query.test.ts
git commit -m "feat(drug-details): add batch filter and FEFO ranking helpers"
```

---

### Task 3: Cardex balance + form validation (TDD)

**Files:**
- Create: `src/lib/drug-details/cardex-balance.ts`
- Create: `src/lib/drug-details/validation.ts`
- Test: `tests/unit/drug-details/cardex-balance.test.ts`
- Test: `tests/unit/drug-details/validation.test.ts`

**Interfaces:**
- Produces:
  - `computeRunningBalances(events: { id: string; qtyIn: number; qtyOut: number }[]): Map<string, number>` — chronological input assumed oldest→newest; balance after each event
  - `validateAddBatch(input): { ok: true; value } | { ok: false; errors: Record<string, string> }`
  - `validateCatalogEdit(input)` / `validateShelfMove(input)` similarly

- [ ] **Step 1: Failing tests**

```ts
// cardex-balance.test.ts
import { describe, expect, it } from 'vitest'
import { computeRunningBalances } from '@/lib/drug-details/cardex-balance'

it('accumulates in minus out', () => {
  const map = computeRunningBalances([
    { id: 'e1', qtyIn: 100, qtyOut: 0 },
    { id: 'e2', qtyIn: 0, qtyOut: 30 },
    { id: 'e3', qtyIn: 10, qtyOut: 5 },
  ])
  expect(map.get('e1')).toBe(100)
  expect(map.get('e2')).toBe(70)
  expect(map.get('e3')).toBe(75)
})
```

```ts
// validation.test.ts
import { describe, expect, it } from 'vitest'
import { validateAddBatch } from '@/lib/drug-details/validation'

it('requires batchNo, expiry, quantity > 0, location', () => {
  const result = validateAddBatch({
    batchNo: '',
    productionISO: '2024-01-01',
    expiryISO: '',
    quantity: 0,
    buyPriceRial: 1,
    consumerPriceRial: 2,
    locationLabel: '',
    supplierLabel: 'x',
  })
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.errors.batchNo).toMatch(/سری/)
    expect(result.errors.expiryISO).toBeTruthy()
    expect(result.errors.quantity).toBeTruthy()
    expect(result.errors.locationLabel).toBeTruthy()
  }
})

it('rejects expiry before production', () => {
  const result = validateAddBatch({
    batchNo: 'A1',
    productionISO: '2025-01-01',
    expiryISO: '2024-01-01',
    quantity: 5,
    buyPriceRial: 1000,
    consumerPriceRial: 1200,
    locationLabel: 'A-1',
    supplierLabel: 'پخش',
  })
  expect(result.ok).toBe(false)
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement helpers with Persian messages** (e.g. «شماره سری ساخت الزامی است.»)

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/drug-details/cardex-balance.ts src/lib/drug-details/validation.ts tests/unit/drug-details/cardex-balance.test.ts tests/unit/drug-details/validation.test.ts
git commit -m "feat(drug-details): add cardex balance and form validation"
```

---

### Task 4: Mock DAL — detail, batches, cardex, mutations

**Files:**
- Create: `src/lib/mock/cardex.ts`
- Create: `src/lib/mock/drugDetails.ts`
- Test: `tests/unit/drug-details/mock-dal.test.ts`

**Interfaces:**
- Produces types + functions:

```ts
export type DrugDetailProfile = {
  drugId: string
  nameEn: string
  irc: string
  legalClassLabel: string
  storageLabel: string
  fefoEnabled: boolean
  rxLabel: string
  clinicalNotes: string[]
  logisticsNotes: string[]
  supplierName: string
  // editable catalog mirrors — synced from MOCK_DRUGS clone
  nameFa: string
  brandName: string
  manufacturer: string
  atcCode: string
  gtin: string
  dosageForm: string
  strength: string
  reorderLevel: number
  isControlled: boolean
}

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

// Session-local mocks only — not persisted server state. Survive client
// navigations; lost on full reload. No edit/delete of historical movements
// except append via mutations below.
export function getDrugDetail(drugId: string): Promise<DrugDetailProfile | null>
export function getDrugBatches(drugId: string): Promise<DrugBatchRow[]>
export function getCardexMovements(drugId: string): Promise<CardexMovement[]>
export function addBatch(input: ...): Promise<DrugBatchRow>
export function updateDrugCatalog(drugId: string, patch: Partial<...>): Promise<DrugDetailProfile>
export function moveBatchShelf(batchId: string, locationLabel: string): Promise<DrugBatchRow>
export function quarantineBatch(batchId: string): Promise<DrugBatchRow>
export function resetDrugDetailsMocksForTests(): void
```

**Seed rules:**
- Fixed `MOCK_DRUG_DETAILS_TODAY = '2026-11-11'`.
- At least 4 batches for `d-001` (metformin) matching Stitch story; batches for ≥3 other drugs so catalog links work.
- ~12–20 cardex movements for `d-001` over ~30 days; include inbound/outbound/transfer/adjustment/quarantine.
- Reuse real `MOCK_DRUGS` ids (`d-001`, …); shelf labels consistent with shelves mock style (`قفسه A-12 / رد ۳`).
- Fake invoice numbers like `INV-MOCK-1001` only — no PII.

- [ ] **Step 1: Failing DAL test**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  addBatch,
  getCardexMovements,
  getDrugBatches,
  getDrugDetail,
  quarantineBatch,
  resetDrugDetailsMocksForTests,
} from '@/lib/mock/drugDetails'

beforeEach(() => {
  resetDrugDetailsMocksForTests()
})

it('loads metformin detail', async () => {
  const detail = await getDrugDetail('d-001')
  expect(detail?.nameFa).toContain('متفورمین')
  expect(detail?.irc).toBeTruthy()
})

it('addBatch appends batch and inbound cardex', async () => {
  const before = await getDrugBatches('d-001')
  await addBatch({
    drugId: 'd-001',
    batchNo: 'TEST-99',
    productionISO: '2025-01-01',
    expiryISO: '2027-01-01',
    quantity: 12,
    buyPriceRial: 1000,
    consumerPriceRial: 1500,
    locationLabel: 'قفسه Z-1',
    supplierLabel: 'پخش آزمایشی',
  })
  const after = await getDrugBatches('d-001')
  expect(after.length).toBe(before.length + 1)
  const moves = await getCardexMovements('d-001')
  expect(moves.some((m) => m.batchNo === 'TEST-99' && m.qtyIn === 12)).toBe(true)
})

it('quarantineBatch flips status and appends movement', async () => {
  const batches = await getDrugBatches('d-001')
  const target = batches.find((b) => b.status === 'active' && b.quantity > 0)!
  await quarantineBatch(target.id)
  const updated = (await getDrugBatches('d-001')).find((b) => b.id === target.id)
  expect(updated?.status).toBe('quarantine')
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement mocks** with `delay(40)` like other mocks; clone seed into mutable arrays inside module.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/cardex.ts src/lib/mock/drugDetails.ts tests/unit/drug-details/mock-dal.test.ts
git commit -m "feat(drug-details): add session-local detail/batch/cardex mocks"
```

---

### Task 5: Export helpers (CSV + print HTML)

**Files:**
- Create: `src/lib/drug-details/export.ts`
- Test: `tests/unit/drug-details/export.test.ts`

**Interfaces:**
- `buildBatchesCsv(rows: DrugBatchRow[]): string` — UTF-8 BOM prefix `\uFEFF`, Persian headers, ISO + Jalali columns
- `buildCardexPrintHtml(detail: { nameFa: string }, movements: Array<CardexMovement & { balance: number }>): string`
- `buildBarcodeLabelHtml(detail, locationHint: string): string`

Reuse `formatJalaliDate` / `toPersianDigits` from `@/lib/persian`. Mirror BOM pattern from `src/lib/audit/export.ts`.

- [ ] **Step 1–4: TDD** — assert BOM charCode 0xfeff, header includes `شماره سری ساخت`, ISO column present.

- [ ] **Step 5: Commit**

```bash
git add src/lib/drug-details/export.ts tests/unit/drug-details/export.test.ts
git commit -m "feat(drug-details): add client CSV and print HTML exporters"
```

---

### Task 6: Page shell + main view (read path)

**Files:**
- Create: `src/app/drug-details-cardex/page.tsx`
- Create: `src/app/drug-details-cardex/nav.ts`
- Create: `src/app/drug-details-cardex/drug-details-view.tsx`
- Modify: `src/app/page.tsx` (add home link like other screens)
- Modify: `src/components/layout/sidebar.tsx` only if other Phase G screens registered a nav item — follow existing pattern; if catalog is linked but detail is not a sidebar item in Stitch as primary, skip new sidebar entry unless AppShell nav already expects it.

**Behavior for this task (read-only UI first):**
- `page.tsx` Suspense + metadata title `جزئیات دارو و کاردکس | انبار دارو`
- Client view: `useSearchParams` + `useRouter` to sync `DrugDetailsUrlState`
- Load detail/batches/movements; skeleton; not-found panel with Link to `/drug-catalog`
- Hero + 4 KPIs + Tabs (batches table stub rows, cardex timeline+table, info cards)
- Match Stitch labels in Persian
- Batch filter chips write `batchFilter` to URL; search writes `q`; tab writes `tab`
- Pagination via shared `Pagination`
- Row actions / drawers can be stubs that open empty drawers — wired in Task 7

**Pattern references:** `src/app/audit-log/audit-log-view.tsx`, `src/app/expiry-alerts-fefo/expiry-alerts-view.tsx`, `src/components/domain/kardex-timeline.tsx`

- [ ] **Step 1: Implement page + nav + view** composing DS only. Map cardex movements to `KardexTimelineItem` (tone from type: inbound→`inbound`, outbound→`outbound`, quarantine→`alert`, else `neutral`). Display newest-first in UI; compute balances via `computeRunningBalances` on chronological copy then reverse for display.

- [ ] **Step 2: Manual/typecheck**

Run: `pnpm typecheck`  
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/app/drug-details-cardex src/app/page.tsx
git commit -m "feat(drug-details): scaffold cardex page read UI with URL tabs"
```

---

### Task 7: Mutations UI (drawers, confirm, toasts)

**Files:**
- Modify: `src/app/drug-details-cardex/drug-details-view.tsx`

Wire Stitch actions:

| Control | Implementation |
|---------|----------------|
| ثبت بچ جدید | SideDrawer form → `validateAddBatch` → `addBatch` → toast → refresh |
| ویرایش کاتالوگ | SideDrawer → `updateDrugCatalog` |
| جابجایی قفسه | SideDrawer → `moveBatchShelf` |
| قرنطینه | ConfirmDialog → `quarantineBatch` |
| مشاهده فاکتور | Read-only SideDrawer showing `invoiceNo` + supplier or empty copy |
| راهنما FEFO | Dialog static Persian protocol text |
| Escape / focus return | Use existing SideDrawer/ConfirmDialog focus behavior; keep `data-origin` ref on trigger |

After each successful mutation, re-fetch lists (or update local state from return values) so KPIs, table, timeline stay consistent.

- [ ] **Step 1: Implement forms with Persian labels matching Stitch fields**

- [ ] **Step 2: Unit test already covers DAL; optionally add RTL test only if project pattern exists — prefer e2e in Task 9**

- [ ] **Step 3: `pnpm typecheck && pnpm lint`**

- [ ] **Step 4: Commit**

```bash
git add src/app/drug-details-cardex/drug-details-view.tsx
git commit -m "feat(drug-details): wire session-local batch and catalog mutations"
```

---

### Task 8: Print / CSV actions + catalog links

**Files:**
- Modify: `src/app/drug-details-cardex/drug-details-view.tsx`
- Modify: `src/app/drug-catalog/drug-catalog-view.tsx` (replace `href="#"` placeholders)

Catalog links:

```tsx
href={`/drug-details-cardex?drugId=${row.id}`}
```

Remove obsolete `title="مسیر جزئیات دارو هنوز پیاده‌سازی نشده..."`.

Export buttons:
- Batches download → `buildBatchesCsv(filteredRows)` + Blob download `batches-<drugId>.csv`
- Print cardex → open `buildCardexPrintHtml(...)` in new window → `print()`
- Print barcode → `buildBarcodeLabelHtml(...)`

- [ ] **Step 1: Implement**

- [ ] **Step 2: Commit**

```bash
git add src/app/drug-details-cardex/drug-details-view.tsx src/app/drug-catalog/drug-catalog-view.tsx
git commit -m "feat(drug-details): link catalog and add client export/print"
```

---

### Task 9: Playwright e2e + screenshots + PROGRESS

**Files:**
- Create: `tests/e2e/drug-details-cardex.spec.ts`
- Modify: `docs/design-system/PROGRESS.md`
- Create: `02-project/images/h13-drug-details-desktop.png` (and tablet/mobile) via Playwright screenshot paths used in prior specs

**E2E cases:**
1. Desktop 1280×900 visual screenshot of `/drug-details-cardex?drugId=d-001`
2. Tablet 768×1024 + mobile 390×844; assert no documentElement horizontal overflow
3. From `/drug-catalog` click drug name → URL contains `drugId=`
4. Click cardex tab → URL `tab=cardex`; timeline + table visible
5. Keyboard: open add-batch drawer (or quarantine confirm), Escape closes, focus returns

Follow `tests/e2e/audit-log.spec.ts` / `expiry-alerts-fefo.spec.ts` webServer/`PLAYWRIGHT_PORT` pattern.

- [ ] **Step 1: Write spec**

- [ ] **Step 2: Run**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
PLAYWRIGHT_PORT=3045 pnpm exec playwright test tests/e2e/drug-details-cardex.spec.ts
```

Expected: all green; route `/drug-details-cardex` in build output.

- [ ] **Step 3: Append PROGRESS.md** section «Phase G — Screen 7: `drug-details-cardex`» with files, commands, responsive strategy (column priority), export notes, Needed components (none or list).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/drug-details-cardex.spec.ts docs/design-system/PROGRESS.md 02-project/images/h13-drug-details-*.png
git commit -m "test(drug-details): add Playwright coverage and progress notes"
```

- [ ] **Step 5: STOP** — do not start another screen.

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
|------------------|------|
| Route `?drugId=` + full URL state | 1, 6 |
| AppShell, breadcrumb, back to catalog | 6, 8 |
| Hero, KPIs, 3 tabs Stitch layout | 6 |
| Batches table + chips + search | 2, 6 |
| Cardex table + KardexTimeline | 6 |
| Clinical info cards | 6 |
| Session-local mutations + drawers/confirm | 4, 7 |
| FEFO ranking / badges with text | 2, 6 |
| CSV BOM + print cardex/barcode | 5, 8 |
| Catalog link wiring | 8 |
| Loading / empty / not-found / error | 6 |
| Vitest helpers | 1–5 |
| Playwright + PROGRESS + stop | 9 |
| Needed-components stop rule | Global + Task 6 |
| No secrets / Persian heading | Global |

## Placeholder / consistency notes

- Helper folder locked: `src/lib/drug-details/` (not `cardex/`).
- Mock entry: `src/lib/mock/drugDetails.ts` + `src/lib/mock/cardex.ts`.
- `DrugBatchRow.status` uses `quarantine` (not `quarantined`) to match URL filter token; map from expiry mock statuses if reusing rows.
- Page sizes `[10, 25, 50]` per spec alignment with earlier screens.
