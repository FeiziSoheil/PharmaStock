# Internal Transfer (`internal-transfer`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/internal-transfer` — a two-step internal stock-transfer wizard that persists Mongo drafts and moves/splits live batches only on confirm.

**Architecture:** New Go package `internal/transfer` owns `InternalTransfer` documents (`draft` → `confirmed`). Confirm orchestrates existing `shelf` / `cardex` / `audit` (full relocate vs quantity split). Next.js wizard reuses `Stepper`, `AppShell`, and the existing API facade pattern. Do **not** touch `internal/receipt` or `/invoice-receipts` (parallel agent).

**Tech Stack:** Go + Echo + MongoDB, Next.js App Router, React, TypeScript, Vitest, Playwright, existing PharmaStock design system.

**Spec:** `docs/superpowers/specs/2026-11-12-internal-transfer-design.md`  
**Visual SoT:** `docs/stitch-reference/screens/internal-transfer/`

## Global Constraints

- App code only under `02-project/app/`.
- Persian main headings on the business page; RTL.
- No real secrets or committed `.env` (`.env.example` placeholders only).
- Do not edit `README.md`, `BRIEF.md`, `templates/`, or `tools/export-agent-logs.py`.
- Do not modify `backend/internal/receipt/**` or `src/app/invoice-receipts/**`.
- Keep `expiry.UpdateLocation` working for drug-details single-batch relocate.
- Working directories: frontend from `02-project/app`; Go from `02-project/app/backend`.
- Frontend tests: `pnpm test` / `pnpm exec vitest run …`; Go: `go test ./…`; e2e needs Mongo + API + Next.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/types/transfers.ts` | Frontend transfer types |
| `src/lib/transfers/gating.ts` | Step / confirm gating helpers |
| `tests/unit/transfers/gating.test.ts` | Vitest for gating |
| `backend/internal/transfer/entity.go` | `Transfer`, `Header`, `Line`, statuses |
| `backend/internal/transfer/repository.go` | Mongo CRUD |
| `backend/internal/transfer/service.go` | Create/Get/List/Patch/Lines/Confirm |
| `backend/internal/transfer/handler.go` | HTTP handlers |
| `backend/internal/transfer/dto.go` | Request DTOs if needed |
| `backend/internal/transfer/service_test.go` | Go unit tests (fakes) |
| `backend/pkg/database/mongo.go` | Index `internal_transfers` |
| `backend/cmd/api/bootstrap/app.go` | Wire transfer deps |
| `backend/cmd/api/bootstrap/routes.go` | Register `/transfers*` |
| `backend/internal/seed/seed.go` | Optional sample draft transfer |
| `src/lib/api/transfers.ts` | HTTP client |
| `src/lib/transfers/data-access.ts` | DAL facade |
| `src/app/internal-transfer/page.tsx` | Route shell |
| `src/app/internal-transfer/internal-transfer-view.tsx` | Wizard UI |
| `src/lib/nav/app-nav.ts` | Sidebar entry |
| `src/lib/types/index.ts` | Re-export transfers |
| `tests/e2e/internal-transfer.spec.ts` | Playwright happy path |
| `docs/backend/FRONTEND-WIREUP.md` | Document new endpoints |

---

### Task 1: Client types + step gating (TDD)

**Files:**
- Create: `src/lib/types/transfers.ts`
- Create: `src/lib/transfers/gating.ts`
- Modify: `src/lib/types/index.ts`
- Test: `tests/unit/transfers/gating.test.ts`

**Interfaces:**
- Produces:
  - Types: `TransferStatus`, `TransferReason`, `TransferHeader`, `TransferLine`, `InternalTransfer`
  - `canAdvanceToStep2(lines): boolean` — ≥1 line, each has `sourceBatchId`, `quantity > 0`
  - `canConfirmTransfer(transfer): boolean` — `draft` + `canAdvanceToStep2` + every line has `destLocationLabel` or `destBinId`
  - `sumTransferUnits(lines): number` — sum of line quantities

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  canAdvanceToStep2,
  canConfirmTransfer,
  sumTransferUnits,
} from '@/lib/transfers/gating'
import type { InternalTransfer, TransferLine } from '@/lib/types/transfers'

const line = (over: Partial<TransferLine> = {}): TransferLine => ({
  id: 'l1',
  drugId: 'drug-amox',
  nameFa: 'آموکسی‌سیلین',
  batchNo: 'B1',
  expiry: '2027-01-01',
  sourceBatchId: 'batch-1',
  sourceLocationLabel: 'سالن A > قفسه 02',
  quantity: 10,
  unitLabel: 'بسته',
  matchStatus: 'barcode',
  ...over,
})

const draft = (over: Partial<InternalTransfer> = {}): InternalTransfer => ({
  id: 't1',
  status: 'draft',
  currentStep: 1,
  header: {
    reason: 'routine_front',
    sourceZone: 'warehouse',
    destZone: 'dispensing',
    sourceLabel: 'انبار مرکزی',
    destLabel: 'پیشخوان نسخه‌پیچی',
  },
  lines: [line({ destLocationLabel: 'پیشخوان 2 > استند B' })],
  createdBy: { userId: 'u1', name: 'اپراتور', role: 'warehouse_operator' },
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('sumTransferUnits', () => {
  it('sums quantities', () => {
    expect(sumTransferUnits([line({ quantity: 10 }), line({ id: 'l2', quantity: 5 })])).toBe(15)
  })
})

describe('canAdvanceToStep2', () => {
  it('needs at least one complete source line', () => {
    expect(canAdvanceToStep2([])).toBe(false)
    expect(canAdvanceToStep2([line({ quantity: 0 })])).toBe(false)
    expect(canAdvanceToStep2([line()])).toBe(true)
  })
})

describe('canConfirmTransfer', () => {
  it('requires dest on every line and draft status', () => {
    expect(canConfirmTransfer(draft())).toBe(true)
    expect(canConfirmTransfer(draft({ lines: [line()] }))).toBe(false)
    expect(canConfirmTransfer(draft({ status: 'confirmed' }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm exec vitest run tests/unit/transfers/gating.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement types + helpers**

```ts
// src/lib/types/transfers.ts
export type TransferStatus = 'draft' | 'confirmed' | 'cancelled'
export type TransferReason =
  | 'routine_front'
  | 'urgent_rx'
  | 'night_cap'
  | 'fefo_move'
export type MatchStatus = 'barcode' | 'physical'

export type TransferHeader = {
  reason: TransferReason
  sourceZone: string
  destZone: string
  sourceLabel: string
  destLabel: string
  note?: string
  receiverName?: string
}

export type TransferLine = {
  id: string
  drugId: string
  nameFa: string
  batchNo: string
  expiry: string
  sourceBatchId: string
  sourceBinId?: string
  sourceLocationLabel: string
  destBinId?: string
  destLocationLabel?: string
  quantity: number
  unitLabel: string
  matchStatus: MatchStatus
}

export type InternalTransfer = {
  id: string
  status: TransferStatus
  currentStep: 1 | 2
  header: TransferHeader
  lines: TransferLine[]
  transferNo?: string
  resultBatchIds?: string[]
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
}

export const TRANSFER_REASON_LABELS: Record<TransferReason, string> = {
  routine_front: 'شارژ روتین پیشخوان نسخه‌پیچی',
  urgent_rx: 'کسری نسخه فوری و بیمار در انتظار',
  night_cap: 'تکمیل سقف موجودی شیفت شب',
  fefo_move: 'جابجایی بر اساس تاریخ انقضای نزدیک (FEFO)',
}
```

```ts
// src/lib/transfers/gating.ts
import type { InternalTransfer, TransferLine } from '@/lib/types/transfers'

export function sumTransferUnits(lines: TransferLine[]): number {
  return lines.reduce((sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0), 0)
}

export function canAdvanceToStep2(lines: TransferLine[]): boolean {
  return (
    lines.length > 0 &&
    lines.every(
      (l) =>
        Boolean(l.sourceBatchId) &&
        Boolean(l.drugId) &&
        Boolean(l.batchNo) &&
        typeof l.quantity === 'number' &&
        l.quantity > 0,
    )
  )
}

export function canConfirmTransfer(transfer: InternalTransfer): boolean {
  if (transfer.status !== 'draft') return false
  if (!canAdvanceToStep2(transfer.lines)) return false
  return transfer.lines.every(
    (l) => Boolean(l.destLocationLabel?.trim()) || Boolean(l.destBinId?.trim()),
  )
}
```

Add to `src/lib/types/index.ts`: `export * from './transfers'`

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm exec vitest run tests/unit/transfers/gating.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** (only if user asked to commit)

```bash
git add src/lib/types/transfers.ts src/lib/transfers/gating.ts src/lib/types/index.ts tests/unit/transfers/gating.test.ts
git commit -m "$(cat <<'EOF'
feat: add internal-transfer types and step gating

EOF
)"
```

---

### Task 2: Go entity + repository + Mongo index

**Files:**
- Create: `backend/internal/transfer/entity.go`
- Create: `backend/internal/transfer/repository.go`
- Modify: `backend/pkg/database/mongo.go` (add `internal_transfers` indexes)

**Interfaces:**
- Produces: `Repository` with `Insert`, `Get`, `List(status, page, pageSize)`, `Replace`, `ClaimDraft(id) (bool, error)` (atomic draft claim like receipts if that pattern exists; otherwise `Replace` + status check in service is enough — prefer matching receipt’s `ClaimDraft` if present)

- [ ] **Step 1: Add entity types**

```go
// backend/internal/transfer/entity.go
package transfer

import "time"

const (
	StatusDraft     = "draft"
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

type Header struct {
	Reason       string `bson:"reason" json:"reason"`
	SourceZone   string `bson:"sourceZone" json:"sourceZone"`
	DestZone     string `bson:"destZone" json:"destZone"`
	SourceLabel  string `bson:"sourceLabel" json:"sourceLabel"`
	DestLabel    string `bson:"destLabel" json:"destLabel"`
	Note         string `bson:"note,omitempty" json:"note,omitempty"`
	ReceiverName string `bson:"receiverName,omitempty" json:"receiverName,omitempty"`
}

type Line struct {
	ID                   string `bson:"id" json:"id"`
	DrugID               string `bson:"drugId" json:"drugId"`
	NameFa               string `bson:"nameFa" json:"nameFa"`
	BatchNo              string `bson:"batchNo" json:"batchNo"`
	Expiry               string `bson:"expiry" json:"expiry"`
	SourceBatchID        string `bson:"sourceBatchId" json:"sourceBatchId"`
	SourceBinID          string `bson:"sourceBinId,omitempty" json:"sourceBinId,omitempty"`
	SourceLocationLabel  string `bson:"sourceLocationLabel" json:"sourceLocationLabel"`
	DestBinID            string `bson:"destBinId,omitempty" json:"destBinId,omitempty"`
	DestLocationLabel    string `bson:"destLocationLabel,omitempty" json:"destLocationLabel,omitempty"`
	Quantity             int    `bson:"quantity" json:"quantity"`
	UnitLabel            string `bson:"unitLabel" json:"unitLabel"`
	MatchStatus          string `bson:"matchStatus" json:"matchStatus"`
}

type CreatedBy struct {
	UserID string `bson:"userId" json:"userId"`
	Name   string `bson:"name" json:"name"`
	Role   string `bson:"role" json:"role"`
}

type Transfer struct {
	ID             string    `bson:"_id" json:"id"`
	Status         string    `bson:"status" json:"status"`
	CurrentStep    int       `bson:"currentStep" json:"currentStep"`
	Header         Header    `bson:"header" json:"header"`
	Lines          []Line    `bson:"lines" json:"lines"`
	TransferNo     string    `bson:"transferNo,omitempty" json:"transferNo,omitempty"`
	ResultBatchIDs []string  `bson:"resultBatchIds,omitempty" json:"resultBatchIds,omitempty"`
	CreatedBy      CreatedBy `bson:"createdBy" json:"createdBy"`
	CreatedAt      time.Time `bson:"createdAt" json:"-"`
	UpdatedAt      time.Time `bson:"updatedAt" json:"-"`
	ConfirmedAt    *time.Time `bson:"confirmedAt,omitempty" json:"-"`
}
```

- [ ] **Step 2: Implement repository** mirroring `receipt/repository.go` (collection name `internal_transfers`): `Insert`, `Get`, `List`, `Replace`, and `ClaimDraft` using `FindOneAndUpdate` status `draft` → processing/claim pattern used by receipts — read `backend/internal/receipt/repository.go` and copy the same claim semantics adapted to transfers.

- [ ] **Step 3: Add indexes in `EnsureIndexes`**

```go
{"internal_transfers", []mongo.IndexModel{
  {Keys: bson.D{{Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}},
  {Keys: bson.D{{Key: "transferNo", Value: 1}}, Options: options.Index().SetSparse(true)},
}},
```

- [ ] **Step 4: Compile check**

Run: `cd backend && go test ./internal/transfer/ -count=0`  
Expected: packages compile (may have no tests yet)

- [ ] **Step 5: Commit** (if user requested)

---

### Task 3: Go service — draft CRUD + lines (TDD)

**Files:**
- Create: `backend/internal/transfer/service.go`
- Create: `backend/internal/transfer/service_test.go`
- Create: `backend/internal/transfer/dto.go` (request structs: `CreateHeader`, `PatchBody`, `AddLineRequest`, `PatchLineRequest`)

**Interfaces:**
- Consumes: `shelf.Repository` (`GetBatch`, `GetBin`), transfer repo
- Produces: `Service` methods `Create`, `Get`, `List`, `Patch`, `AddLine`, `PatchLine`, `DeleteLine` returning JSON-friendly views with RFC3339 timestamps (follow receipt `ReceiptView` pattern — either embed DTO conversion in service or add `ToView`)

Allowed reasons: `routine_front`, `urgent_rx`, `night_cap`, `fefo_move`.  
Allowed matchStatus: `barcode`, `physical`.

- [ ] **Step 1: Write failing service tests with fakes**

Cover at least:
1. `Create` rejects empty `sourceLabel` / invalid reason  
2. `AddLine` copies fields from fake source batch; rejects qty > available  
3. `AddLine` rejects missing batch  
4. `Patch` / line mutations rejected when status is not draft (use a pre-seeded confirmed doc)

Use in-memory fake store map[string]Transfer like receipt tests. Fake shelf:

```go
type fakeShelf struct {
	batches map[string]shelf.StockBatch
	bins    map[string]shelf.Bin
}

func (f *fakeShelf) GetBatch(ctx context.Context, id string) (*shelf.StockBatch, error) {
	b, ok := f.batches[id]
	if !ok {
		return nil, nil
	}
	cp := b
	return &cp, nil
}
func (f *fakeShelf) GetBin(ctx context.Context, id string) (*shelf.Bin, error) {
	b, ok := f.bins[id]
	if !ok {
		return nil, nil
	}
	cp := b
	return &cp, nil
}
```

(Define only the methods the service needs behind small interfaces in `service.go`.)

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && go test ./internal/transfer/ -count=1`  
Expected: FAIL (missing Service)

- [ ] **Step 3: Implement draft CRUD + lines**

Key `AddLine` behavior:
1. Load transfer; must be draft  
2. `GetBatch(sourceBatchId)`; 404 if nil  
3. Reject if `batch.Quantity < req.Quantity` or `req.Quantity <= 0`  
4. Resolve dest from `destBinId` via `GetBin` when provided (set `destLocationLabel` from `bin.Address` if label empty; set zone hints only on header if desired — line keeps dest fields)  
5. Append line with uuid id; `Replace` transfer; bump `UpdatedAt`

Persian validation messages via `errormap.Validation`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && go test ./internal/transfer/ -count=1`  
Expected: PASS

- [ ] **Step 5: Commit** (if user requested)

---

### Task 4: Go service — Confirm (full move + split) (TDD)

**Files:**
- Modify: `backend/internal/transfer/service.go`
- Modify: `backend/internal/transfer/service_test.go`

**Interfaces:**
- Consumes shelf: `GetBatch`, `GetBin`, `UpdateBatchLocation`, `UpdateBatch` (or quantity helper), `InsertBatch`, `DeleteBatch`  
- Consumes cardex: `Append`  
- Consumes audit: `Append`  
- Produces: `Confirm(ctx, id, actor, ip) (view, error)`

Confirm algorithm (from spec — implement exactly):
1. Claim/load draft; else 409  
2. Validate ≥1 line; each has dest label or bin; re-check source qty  
3. Per line:
   - Resolve dest location/bin/zone  
   - Snapshot undo info (old location, old qty, newBatchID if any)  
   - Full qty: `UpdateBatchLocation` on source batch  
   - Partial: `UpdateBatch` source with decremented qty; `InsertBatch` clone at dest with new id + line qty  
   - `cardex.Append` type `transfer`, `QtyOut`/`QtyIn` = moved qty, note `source→dest`  
4. Audit once: action `transfer`, entityType `transfer`  
5. Set confirmed fields + `transferNo` like `TRF-<YYYYMMDD>-<6 hex>`  
6. On error mid-loop: undo recorded mutations best-effort; leave draft; return error  

- [ ] **Step 1: Add failing tests**

1. Happy path full move: source qty 10, line qty 10 → same batch id location updated; cardex appended; status confirmed  
2. Happy path split: source qty 10, line qty 4 → source qty 6; new batch qty 4 at dest  
3. Confirm twice → second call 409  
4. Insufficient qty at confirm → 400, still draft  

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && go test ./internal/transfer/ -run Confirm -count=1`  
Expected: FAIL

- [ ] **Step 3: Implement Confirm + rollback helper**

Do not call into `receipt` package. Prefer shelf repo methods already present (`UpdateBatchLocation`, `UpdateBatch`, `InsertBatch`, `DeleteBatch`).

Cardex note example: `"انتقال داخلی از " + sourceLabel + " به " + destLabel`

- [ ] **Step 4: Run full transfer package tests — PASS**

Run: `cd backend && go test ./internal/transfer/ -count=1`  
Expected: PASS

- [ ] **Step 5: Commit** (if user requested)

---

### Task 5: HTTP handlers + bootstrap wiring

**Files:**
- Create: `backend/internal/transfer/handler.go`
- Modify: `backend/cmd/api/bootstrap/app.go`
- Modify: `backend/cmd/api/bootstrap/routes.go`
- Optional: `backend/internal/seed/seed.go` — one draft transfer

**Interfaces:**
- Mirror `receipt.Handler` method names: `Create`, `Get`, `List`, `Patch`, `AddLine`, `PatchLine`, `DeleteLine`, `Confirm`
- Routes under secured group:

```go
secured.POST("/transfers", r.Transfer.Create)
secured.GET("/transfers", r.Transfer.List)
secured.GET("/transfers/:id", r.Transfer.Get)
secured.PATCH("/transfers/:id", r.Transfer.Patch)
secured.POST("/transfers/:id/lines", r.Transfer.AddLine)
secured.PATCH("/transfers/:id/lines/:lineId", r.Transfer.PatchLine)
secured.DELETE("/transfers/:id/lines/:lineId", r.Transfer.DeleteLine)
secured.POST("/transfers/:id/confirm", r.Transfer.Confirm)
```

- [ ] **Step 1: Implement handler** using `requestctx.ActorFrom` / echo JSON bind patterns from `receipt/handler.go`

- [ ] **Step 2: Wire in `app.go`** — construct `transfer.NewRepository`, `transfer.NewService(...)`, `transfer.NewHandler`, pass into `Routes`

- [ ] **Step 3: Extend `Routes` struct** with `Transfer *transfer.Handler` and register routes

- [ ] **Step 4: Compile + unit tests**

Run: `cd backend && go test ./internal/transfer/ ./cmd/api/bootstrap/ -count=1`  
Expected: PASS (bootstrap may only compile)

- [ ] **Step 5: Manual smoke (optional)** — login + `POST /api/v1/transfers` with JWT

- [ ] **Step 6: Commit** (if user requested)

---

### Task 6: Frontend API client + data-access

**Files:**
- Create: `src/lib/api/transfers.ts`
- Create: `src/lib/transfers/data-access.ts`
- Modify: `docs/backend/FRONTEND-WIREUP.md`

**Interfaces:**
- Produces async functions matching receipt client style: `createTransfer`, `getTransfer`, `listTransfers`, `patchTransfer`, `addTransferLine`, `patchTransferLine`, `deleteTransferLine`, `confirmTransfer`
- Parse API JSON into `InternalTransfer` (map ISO timestamp fields if server returns `createdAt`/`updatedAt` as strings)

- [ ] **Step 1: Implement `src/lib/api/transfers.ts`** using existing `apiRequest` helper from other clients (`src/lib/api/receipts.ts` as template). Paths: `/api/v1/transfers...`

- [ ] **Step 2: Implement thin `data-access.ts` facade** re-exporting the API functions (same pattern as receipts).

- [ ] **Step 3: Document in FRONTEND-WIREUP.md** a table row for `/internal-transfer` and endpoint list for `/api/v1/transfers`.

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit` (or project’s usual typecheck script)  
Expected: no errors from new files

- [ ] **Step 5: Commit** (if user requested)

---

### Task 7: Wizard UI page

**Files:**
- Create: `src/app/internal-transfer/page.tsx`
- Create: `src/app/internal-transfer/internal-transfer-view.tsx`
- Modify: `src/lib/nav/app-nav.ts`

**Interfaces:**
- Page reads `transferId` from searchParams; loads via data-access or starts create-on-header-save
- View props: initial transfer optional
- Nav: add `AppNavId` value `'internal-transfer'` and item label `انتقال داخلی`, href `/internal-transfer`, icon `swap_horiz` (or `sync_alt` if in icon registry — use a name that exists in `src/lib/icons/registry.ts`)

UI requirements:
- `AppShell` + Persian `h1`: `فرم حواله انتقال داخلی کالا (انبار اصلی به پیشخوان تحویل نسخه)`
- `Stepper` two steps with Stitch Persian labels
- Header card: source/dest labels + reason `<Select>`
- Step 1: drug search (reuse drugs list API), FEFO batches via existing expiry/shelf list filtered by `drugId`, qty input, dest bin select from shelves list, add line button, lines table with delete
- Step 2: KPI cards via `KpiMetricCard` / simple metrics; checklist (local state); confirm button disabled unless `canConfirmTransfer`; on success toast + set read-only
- `data-slot="internal-transfer"` on root for e2e

- [ ] **Step 1: Update `app-nav.ts`**

```ts
export type AppNavId =
  | 'dashboard'
  | 'catalog'
  | 'drug-details'
  | 'shelf'
  | 'alerts'
  | 'reorder'
  | 'audit-log'
  | 'internal-transfer'
```

Add nav item after shelf (or after alerts):

```ts
{
  id: 'internal-transfer',
  label: 'انتقال داخلی',
  href: '/internal-transfer',
  icon: 'swap_horiz', // verify in registry; fallback to existing icon name
},
```

- [ ] **Step 2: Create `page.tsx`** client/server shell consistent with sibling pages (read how `src/app/shelf-inventory/page.tsx` or a wizard-like page is structured — prefer the same AppShell wrapping pattern as `drug-catalog`).

- [ ] **Step 3: Implement `internal-transfer-view.tsx`** wired to data-access; create draft on first header save if no `transferId`, then `router.replace(?transferId=)`.

- [ ] **Step 4: Manual visual check against Stitch screenshot** (layout, not pixel-perfect).

- [ ] **Step 5: Commit** (if user requested)

---

### Task 8: Playwright e2e + verification

**Files:**
- Create: `tests/e2e/internal-transfer.spec.ts`

**Interfaces:**
- Assumes seeded Mongo + running API + Next (same as other Phase G e2e). If e2e auth helper exists (login fixture), reuse it.

- [ ] **Step 1: Write e2e**

```ts
import { expect, test } from '@playwright/test'

test.describe('internal-transfer', () => {
  test('shows Persian heading and stepper', async ({ page }) => {
    await page.goto('/internal-transfer')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /فرم حواله انتقال داخلی/,
      }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('انتخاب اقلام و تخصیص بَچ')).toBeVisible()
  })

  test('happy path draft line confirm when API available', async ({ page }) => {
    test.skip(
      !process.env.E2E_API,
      'Set E2E_API=1 with API+Mongo for full flow',
    )
    // 1) login via existing helper if present
    // 2) goto /internal-transfer
    // 3) set reason, create draft
    // 4) pick a seeded drug/batch, set dest, add line
    // 5) step 2 → confirm
    // 6) expect read-only transferNo or success toast
  })
})
```

Adapt the happy-path body to whatever login helper other e2e specs use (inspect `tests/e2e/login.spec.ts` / drug-catalog). If full API flow is too brittle in CI, keep the heading/stepper test always-on and mark API path with the same env gate other API e2e use — do not invent a new CI contract.

- [ ] **Step 2: Run unit + go + targeted e2e**

```bash
pnpm exec vitest run tests/unit/transfers/gating.test.ts
cd backend && go test ./internal/transfer/ -count=1
pnpm exec playwright test tests/e2e/internal-transfer.spec.ts
```

Expected: all green (API happy path skipped if env unset)

- [ ] **Step 3: Final commit** (if user requested)

---

## Spec coverage self-check

| Spec section | Task |
|--------------|------|
| 2-step wizard + Persian headings | 7 |
| draft→confirmed Mongo doc | 2–4 |
| Partial qty split + full move | 4 |
| API table `/transfers*` | 5–6 |
| Confirm audit + cardex | 4 |
| Out of scope / no receipt collision | Global + Tasks 4–7 |
| Gating unit tests | 1 |
| Go unit confirm/split | 3–4 |
| E2E | 8 |
| FRONTEND-WIREUP + nav | 6–7 |

## Placeholder / consistency notes

- Reason codes and matchStatus enums identical in TS + Go.
- Query param `transferId` (not `id`) for resume.
- Collection name `internal_transfers`.
- Audit action `transfer`; cardex type `transfer`.
