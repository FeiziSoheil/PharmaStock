# Dispensing Dispatch (`dispensing-dispatch`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/dispensing-dispatch` — a FEFO dispensing workstation that persists Mongo drafts and deducts live stock only on confirm.

**Architecture:** New Go package `internal/dispensing` owns `DispenseOrder` documents (`draft` → `confirmed`). Line add resolves drug + picks FEFO batch via shelf. Confirm decrements batch qty, appends cardex outbound, writes audit. Next.js single-screen UI reuses AppShell and the receipts API facade pattern.

**Tech Stack:** Go + Echo + MongoDB, Next.js App Router, React, TypeScript, Vitest, Playwright, existing PharmaStock design system.

**Spec:** `docs/superpowers/specs/2026-11-12-dispensing-dispatch-design.md`  
**Visual SoT:** `docs/stitch-reference/screens/dispensing-dispatch/`

## Global Constraints

- App code only under `02-project/app/`.
- Persian main headings on the business page; RTL; integer Rial; ISO dates in API.
- No real secrets or committed `.env` (`.env.example` placeholders only).
- Do not edit `README.md`, `BRIEF.md`, `templates/`, or `tools/export-agent-logs.py`.
- Do not modify `internal/receipt` or invent `internal/transfer` changes for this feature.
- Working directories: frontend commands from `02-project/app`; Go from `02-project/app/backend`.
- Frontend tests: `pnpm test`; Go: `go test ./...`; e2e needs Mongo + API + Next.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/types/dispenses.ts` | Frontend domain types |
| `src/lib/dispenses/gating.ts` | Totals + `canConfirmDispense` |
| `tests/unit/dispenses/gating.test.ts` | Vitest for gating/totals |
| `backend/internal/shelf/repository.go` | Add `UpdateBatchQuantity` |
| `backend/internal/dispensing/fefo.go` | Pure FEFO pick among batches |
| `backend/internal/dispensing/fefo_test.go` | FEFO unit tests |
| `backend/internal/dispensing/entity.go` | `Order`, `Line`, `Patient`, `Fees`, statuses |
| `backend/internal/dispensing/dto.go` | Create/patch/line DTOs + view totals |
| `backend/internal/dispensing/repository.go` | Mongo CRUD `dispense_orders` |
| `backend/internal/dispensing/service.go` | Create/Get/List/Patch/Lines/Clear/Confirm/FEFOPreview |
| `backend/internal/dispensing/service_test.go` | Service tests with fakes |
| `backend/internal/dispensing/handler.go` | Echo handlers |
| `backend/pkg/database/mongo.go` | Index `dispense_orders` |
| `backend/cmd/api/bootstrap/app.go` | Wire dispensing deps |
| `backend/cmd/api/bootstrap/routes.go` | Register `/dispenses*` (fefo-preview before `:id`) |
| `backend/internal/seed/seed.go` | Optional sample draft order |
| `src/lib/api/dispenses.ts` | HTTP client |
| `src/lib/dispenses/data-access.ts` | DAL facade |
| `src/app/dispensing-dispatch/page.tsx` | Route shell |
| `src/app/dispensing-dispatch/nav.ts` | Nav id helper |
| `src/app/dispensing-dispatch/dispensing-dispatch-view.tsx` | Workstation UI |
| `src/lib/nav/app-nav.ts` | Sidebar «حواله خروج و فروش» |
| `src/app/dashboard/dashboard-view.tsx` | CTA → `/dispensing-dispatch` |
| `tests/e2e/dispensing-dispatch.spec.ts` | Playwright happy path |
| `docs/backend/FRONTEND-WIREUP.md` | Document new endpoints |

---

### Task 1: Client types + gating (TDD)

**Files:**
- Create: `src/lib/types/dispenses.ts`
- Create: `src/lib/dispenses/gating.ts`
- Test: `tests/unit/dispenses/gating.test.ts`

**Interfaces:**
- Produces:
  - Types: `DispenseStatus`, `DispensePatient`, `DispenseControlled`, `DispenseLine`, `DispenseFees`, `DispenseOrder`, `DispenseTotals`
  - `computeDispenseTotals(order): DispenseTotals`
  - `canConfirmDispense(order): boolean`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { canConfirmDispense, computeDispenseTotals } from '@/lib/dispenses/gating'
import type { DispenseLine, DispenseOrder } from '@/lib/types/dispenses'

const line = (over: Partial<DispenseLine> = {}): DispenseLine => ({
  id: 'l1',
  drugId: 'drug-amox',
  nameFa: 'آموکسی‌سیلین',
  unitLabel: 'عدد',
  quantity: 2,
  consumerPrice: 45000,
  batchId: 'batch-amox-1',
  batchNo: 'AX-2401',
  expiry: '2026-12-01',
  locationLabel: 'A-03-2-04',
  allocation: 'fefo',
  isColdChain: false,
  isControlled: false,
  ...over,
})

const order = (over: Partial<DispenseOrder> = {}): DispenseOrder => ({
  id: 'd1',
  status: 'draft',
  patient: { nameFa: 'بیمار نمونه' },
  lines: [line()],
  fees: { technicalFee: 50000, insuranceCover: 0 },
  createdBy: { userId: 'u1', name: 'اپراتور', role: 'operator' },
  createdAt: '2026-11-12T00:00:00Z',
  updatedAt: '2026-11-12T00:00:00Z',
  ...over,
})

describe('computeDispenseTotals', () => {
  it('sums goods and patient payable', () => {
    expect(
      computeDispenseTotals(
        order({
          lines: [
            line({ quantity: 2, consumerPrice: 45000 }),
            line({ id: 'l2', quantity: 1, consumerPrice: 890000, isColdChain: true }),
          ],
          fees: { technicalFee: 50000, insuranceCover: 10000 },
        }),
      ),
    ).toEqual({
      goodsTotal: 980000,
      technicalFee: 50000,
      insuranceCover: 10000,
      patientPayable: 1020000,
      lineCount: 2,
      coldCount: 1,
      controlledCount: 0,
    })
  })
})

describe('canConfirmDispense', () => {
  it('rejects empty patient name', () => {
    expect(canConfirmDispense(order({ patient: { nameFa: '  ' } }))).toBe(false)
  })
  it('rejects empty lines', () => {
    expect(canConfirmDispense(order({ lines: [] }))).toBe(false)
  })
  it('rejects incomplete controlled', () => {
    expect(
      canConfirmDispense(
        order({
          lines: [
            line({
              isControlled: true,
              controlled: {
                physicianName: 'دکتر',
                recipientNationalId: '007',
                eRxTrackingId: 'RX-1',
                technicalAck: false,
              },
            }),
          ],
        }),
      ),
    ).toBe(false)
  })
  it('rejects manual without reason', () => {
    expect(
      canConfirmDispense(order({ lines: [line({ allocation: 'manual', manualReason: '' })] })),
    ).toBe(false)
  })
  it('allows complete draft', () => {
    expect(canConfirmDispense(order())).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd 02-project/app && pnpm exec vitest run tests/unit/dispenses/gating.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement types + gating**

`src/lib/types/dispenses.ts`:

```ts
export type DispenseStatus = 'draft' | 'confirmed' | 'cancelled'
export type DispenseAllocation = 'fefo' | 'manual'

export type DispensePatient = {
  nameFa: string
  nationalId?: string
  insuranceLabel?: string
  rxTrackingId?: string
}

export type DispenseControlled = {
  physicianName: string
  physicianLicense?: string
  recipientNationalId: string
  eRxTrackingId: string
  technicalAck: boolean
}

export type DispenseLine = {
  id: string
  drugId: string
  nameFa: string
  nameEn?: string
  irc?: string
  manufacturer?: string
  unitLabel: string
  quantity: number
  consumerPrice: number
  batchId: string
  batchNo: string
  expiry: string
  locationLabel: string
  binId?: string
  allocation: DispenseAllocation
  manualReason?: string
  isColdChain: boolean
  isControlled: boolean
  controlled?: DispenseControlled
}

export type DispenseFees = {
  technicalFee: number
  insuranceCover: number
}

export type DispenseOrder = {
  id: string
  status: DispenseStatus
  orderNo?: string
  patient: DispensePatient
  lines: DispenseLine[]
  fees: DispenseFees
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
  goodsTotal?: number
  patientPayable?: number
  lineCount?: number
  coldCount?: number
  controlledCount?: number
}

export type DispenseTotals = {
  goodsTotal: number
  technicalFee: number
  insuranceCover: number
  patientPayable: number
  lineCount: number
  coldCount: number
  controlledCount: number
}
```

`src/lib/dispenses/gating.ts`:

```ts
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
    if (line.allocation === 'manual' && !(line.manualReason?.trim())) return false
    if (!controlledOk(line)) return false
  }
  return true
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd 02-project/app && pnpm exec vitest run tests/unit/dispenses/gating.test.ts`

- [ ] **Step 5: Commit** (only if user requested commits in this session)

```bash
git add src/lib/types/dispenses.ts src/lib/dispenses/gating.ts tests/unit/dispenses/gating.test.ts
git commit -m "feat(dispenses): add client types and confirm gating"
```

---

### Task 2: Shelf `UpdateBatchQuantity` + FEFO picker (TDD)

**Files:**
- Modify: `backend/internal/shelf/repository.go`
- Create: `backend/internal/dispensing/fefo.go`
- Test: `backend/internal/dispensing/fefo_test.go`

**Interfaces:**
- Produces:
  - `(*shelf.Repository).UpdateBatchQuantity(ctx, id string, quantity int) error`
  - `PickFEFO(batches []shelf.StockBatch, preferDispensing bool) *shelf.StockBatch`
  - `IsColdChainBatch(b shelf.StockBatch) bool` — `Zone=="R"` OR `StorageNote != ""`

- [ ] **Step 1: Write failing FEFO tests**

```go
package dispensing_test

import (
	"testing"

	"pharmastock/backend/internal/dispensing"
	"pharmastock/backend/internal/shelf"
)

func TestPickFEFO_NearestExpiry(t *testing.T) {
	got := dispensing.PickFEFO([]shelf.StockBatch{
		{ID: "later", DrugID: "d1", Quantity: 5, Status: "active", Expiry: "2027-06-01"},
		{ID: "soon", DrugID: "d1", Quantity: 3, Status: "active", Expiry: "2026-12-01"},
	}, true)
	if got == nil || got.ID != "soon" {
		t.Fatalf("got %#v", got)
	}
}

func TestPickFEFO_SkipsZeroAndNonActive(t *testing.T) {
	got := dispensing.PickFEFO([]shelf.StockBatch{
		{ID: "zero", Quantity: 0, Status: "active", Expiry: "2026-01-01"},
		{ID: "quarantine", Quantity: 5, Status: "quarantine", Expiry: "2026-01-01"},
		{ID: "ok", Quantity: 2, Status: "active", Expiry: "2026-06-01"},
	}, true)
	if got == nil || got.ID != "ok" {
		t.Fatalf("got %#v", got)
	}
}

func TestPickFEFO_PreferDispensingZone(t *testing.T) {
	got := dispensing.PickFEFO([]shelf.StockBatch{
		{ID: "main", Quantity: 5, Status: "active", Expiry: "2026-12-01", Zone: "A"},
		{ID: "pos", Quantity: 5, Status: "active", Expiry: "2026-12-01", Zone: "C"},
	}, true)
	if got == nil || got.ID != "pos" {
		t.Fatalf("prefer C zone, got %#v", got)
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd 02-project/app/backend && go test ./internal/dispensing/ -run PickFEFO -count=1`  
Expected: package or PickFEFO undefined

- [ ] **Step 3: Implement FEFO + quantity helper**

`backend/internal/dispensing/fefo.go`:

```go
package dispensing

import (
	"strings"
	"time"

	"pharmastock/backend/internal/shelf"
)

func IsColdChainBatch(b shelf.StockBatch) bool {
	if b.Zone == "R" {
		return true
	}
	return strings.TrimSpace(b.StorageNote) != ""
}

func usable(b shelf.StockBatch) bool {
	if b.Quantity <= 0 {
		return false
	}
	if b.Status != "" && b.Status != "active" {
		return false
	}
	if b.Expiry == "" {
		return true
	}
	exp, err := time.Parse("2006-01-02", b.Expiry)
	if err != nil {
		return true
	}
	today, _ := time.Parse("2006-01-02", time.Now().UTC().Format("2006-01-02"))
	return !exp.Before(today)
}

// PickFEFO returns the best outbound batch. When preferDispensing, zone C wins ties.
func PickFEFO(batches []shelf.StockBatch, preferDispensing bool) *shelf.StockBatch {
	var best *shelf.StockBatch
	for i := range batches {
		cand := &batches[i]
		if !usable(*cand) {
			continue
		}
		if best == nil {
			best = cand
			continue
		}
		best = betterFEFO(best, cand, preferDispensing)
	}
	return best
}

func betterFEFO(a, b *shelf.StockBatch, preferDispensing bool) *shelf.StockBatch {
	if a.Expiry != b.Expiry {
		if a.Expiry == "" {
			return b
		}
		if b.Expiry == "" {
			return a
		}
		if b.Expiry < a.Expiry {
			return b
		}
		if a.Expiry < b.Expiry {
			return a
		}
	}
	if preferDispensing {
		aPos, bPos := a.Zone == "C", b.Zone == "C"
		if bPos && !aPos {
			return b
		}
		if aPos && !bPos {
			return a
		}
	}
	if b.Quantity < a.Quantity {
		return b
	}
	return a
}
```

Add to `shelf/repository.go`:

```go
func (r *Repository) UpdateBatchQuantity(ctx context.Context, id string, quantity int) error {
	set := bson.M{"quantity": quantity}
	if quantity <= 0 {
		set["status"] = "depleted"
	}
	_, err := r.batches.UpdateByID(ctx, id, bson.M{"$set": set})
	return err
}
```

- [ ] **Step 4: Run FEFO tests — PASS**

Run: `cd 02-project/app/backend && go test ./internal/dispensing/ -run PickFEFO -count=1`

- [ ] **Step 5: Commit** (if requested)

```bash
git add backend/internal/shelf/repository.go backend/internal/dispensing/fefo.go backend/internal/dispensing/fefo_test.go
git commit -m "feat(dispensing): FEFO picker and batch quantity update"
```

---

### Task 3: Dispensing entity, repository, DTO, service CRUD + lines (TDD)

**Files:**
- Create: `backend/internal/dispensing/entity.go`
- Create: `backend/internal/dispensing/dto.go`
- Create: `backend/internal/dispensing/repository.go`
- Create: `backend/internal/dispensing/service.go`
- Test: `backend/internal/dispensing/service_test.go`

**Interfaces:**
- Consumes: `PickFEFO`, `IsColdChainBatch`, `shelf.Repository` (`BatchesByDrug`, `GetBatch`, `GetBin`), `drug.Repository` (`Get`, `FindByGTIN`)
- Produces service methods:
  - `Create(ctx, patient, fees, actor) (View, error)`
  - `Get`, `List(status, pagination)`
  - `Patch(id, PatientFeesPatch)`
  - `AddLine(id, LineInput)` — `DrugID` **or** `Barcode`/`GTIN`; default qty 1; FEFO
  - `PatchLine`, `DeleteLine`, `ClearLines`
  - Default `technicalFee = 50000` when create fees omitted

Entity mirrors the TypeScript model (`consumerPrice` JSON field = batch `ConsumerPriceRial`). Controlled nested struct as in spec.

LineInput:

```go
type LineInput struct {
	DrugID   string `json:"drugId"`
	Barcode  string `json:"barcode"`
	GTIN     string `json:"gtin"`
	Quantity int    `json:"quantity"`
}
```

LinePatch:

```go
type LinePatch struct {
	Quantity     *int        `json:"quantity"`
	BatchID      *string     `json:"batchId"`
	ManualReason *string     `json:"manualReason"`
	Controlled   *Controlled `json:"controlled"`
}
```

- [ ] **Step 1: Write failing service tests** (fakes for store/drug/shelf)

Cover at minimum:
1. `AddLine` by `drugId` picks sooner-expiring active batch  
2. `AddLine` rejects when no usable stock (`Validation` with Persian message)  
3. `PatchLine` manual requires reason  
4. Controlled incomplete still allowed on draft patch but flagged for confirm tests in Task 4  
5. Resolve via `GTIN` calls `FindByGTIN`

Use interface stubs in `service_test.go` like receipt tests (`orderStore`, `drugStore`, `batchStore`).

- [ ] **Step 2: Run — expect FAIL**

Run: `cd 02-project/app/backend && go test ./internal/dispensing/ -count=1`

- [ ] **Step 3: Implement entity/dto/repository/service**

Follow `internal/receipt` patterns:
- IDs: `uuid` or `fmt.Sprintf("dsp-%s", short)` consistent with receipt
- Draft-only mutations → `Conflict` if not draft
- `View` embeds order + computed `GoodsTotal`, `PatientPayable`, counts
- On AddLine: load drug → `BatchesByDrug` → `PickFEFO(..., true)` → snapshot line; set `IsControlled` from drug or batch; `IsColdChain` via `IsColdChainBatch`
- Barcode path: treat `Barcode` same as `GTIN` for catalog lookup (`FindByGTIN`); if empty drugId and empty gtin → Validation

- [ ] **Step 4: Tests PASS**

Run: `cd 02-project/app/backend && go test ./internal/dispensing/ -count=1`

- [ ] **Step 5: Commit** (if requested)

```bash
git add backend/internal/dispensing/
git commit -m "feat(dispensing): draft order CRUD and FEFO line add"
```

---

### Task 4: Confirm + rollback (TDD)

**Files:**
- Modify: `backend/internal/dispensing/service.go`
- Modify: `backend/internal/dispensing/service_test.go`

**Interfaces:**
- Consumes: `UpdateBatchQuantity`, `cardex.Append`, `audit.Append` (same shapes as receipt)
- Produces: `Confirm(ctx, id, actor) (View, error)`

Confirm algorithm (exact from spec §§5):
1. Must be draft → else `errormap.Conflict`
2. `patient.nameFa` trim non-empty
3. ≥1 line; each qty > 0
4. Controlled + manualReason gates
5. Re-load each batch; qty check
6. Decrement; cardex `QtyOut`; type `dispensing` or `controlled_dispense`
7. One audit: `dispensing` or `controlled_dispense`; `entityType: "dispense"`
8. `orderNo` like `OUT-` + last 5 of id or jalali-free short counter
9. On failure after mutations: restore previous quantities best-effort; leave draft

- [ ] **Step 1: Failing tests**

```go
func TestConfirm_DeductsAndAudits(t *testing.T) { /* fake batches qty 20 → 18; cardex QtyOut 2; audit action dispensing */ }
func TestConfirm_ControlledRequiresAck(t *testing.T) { /* expect Validation */ }
func TestConfirm_Shortage(t *testing.T) { /* batch qty 1, line qty 2 → Validation */ }
func TestConfirm_ConflictWhenConfirmed(t *testing.T) { /* status confirmed → Conflict */ }
func TestConfirm_RollbackLeavesDraft(t *testing.T) { /* cardex fails mid-way → qty restored, status draft */ }
```

- [ ] **Step 2: Run — FAIL on missing Confirm**

- [ ] **Step 3: Implement Confirm**

Wire dependencies in `NewService` like receipt: repo, drugs, shelf, cardex, audit.

- [ ] **Step 4: PASS**

Run: `cd 02-project/app/backend && go test ./internal/dispensing/ -count=1`

- [ ] **Step 5: Commit** (if requested)

```bash
git add backend/internal/dispensing/
git commit -m "feat(dispensing): confirm outbound deduction with rollback"
```

---

### Task 5: HTTP handlers, routes, indexes, seed

**Files:**
- Create: `backend/internal/dispensing/handler.go`
- Modify: `backend/cmd/api/bootstrap/app.go`
- Modify: `backend/cmd/api/bootstrap/routes.go`
- Modify: `backend/pkg/database/mongo.go`
- Modify: `backend/internal/seed/seed.go` (optional one draft)

**Interfaces:**
- Routes (JWT), **order matters**:

```go
secured.GET("/dispenses/fefo-preview", r.Dispensing.FEFOPreview)
secured.POST("/dispenses", r.Dispensing.Create)
secured.GET("/dispenses", r.Dispensing.List)
secured.GET("/dispenses/:id", r.Dispensing.Get)
secured.PATCH("/dispenses/:id", r.Dispensing.Patch)
secured.POST("/dispenses/:id/lines", r.Dispensing.AddLine)
secured.PATCH("/dispenses/:id/lines/:lineId", r.Dispensing.PatchLine)
secured.DELETE("/dispenses/:id/lines/:lineId", r.Dispensing.DeleteLine)
secured.POST("/dispenses/:id/clear-lines", r.Dispensing.ClearLines)
secured.POST("/dispenses/:id/confirm", r.Dispensing.Confirm)
```

FEFOPreview: query `drugId` required → return picked batch JSON or 404/validation.

Indexes:

```go
{"dispense_orders", []mongo.IndexModel{
  {Keys: bson.D{{Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}},
}},
```

- [ ] **Step 1: Implement handler mirroring `receipt.Handler`**
- [ ] **Step 2: Wire `Routes.Dispensing` + `NewService` in `app.go`**
- [ ] **Step 3: Compile**

Run: `cd 02-project/app/backend && go test ./... -count=1`

- [ ] **Step 4: Manual smoke (optional)** — login + `POST /api/v1/dispenses` with JWT

- [ ] **Step 5: Commit** (if requested)

```bash
git add backend/internal/dispensing/handler.go backend/cmd/api/bootstrap/ backend/pkg/database/mongo.go backend/internal/seed/seed.go
git commit -m "feat(dispensing): wire HTTP routes and Mongo indexes"
```

---

### Task 6: Frontend API client + data-access

**Files:**
- Create: `src/lib/api/dispenses.ts`
- Create: `src/lib/dispenses/data-access.ts`
- Modify: `docs/backend/FRONTEND-WIREUP.md`

**Interfaces:**
- Mirror `src/lib/api/receipts.ts` mapping: API `consumerPrice` ↔ client `consumerPrice`; normalize status; attach `computeDispenseTotals` when server omits totals.
- Exports: `createDispense`, `getDispense`, `listDispenses`, `patchDispense`, `addDispenseLine`, `patchDispenseLine`, `deleteDispenseLine`, `clearDispenseLines`, `confirmDispense`, `fefoPreview`

- [ ] **Step 1: Implement client + thin facade** (same pattern as receipts data-access)
- [ ] **Step 2: Document table in FRONTEND-WIREUP.md** under «حواله خروج (`/api/v1/dispenses`)»
- [ ] **Step 3: Typecheck**

Run: `cd 02-project/app && pnpm exec tsc --noEmit` (or project’s existing check script)

- [ ] **Step 4: Commit** (if requested)

```bash
git add src/lib/api/dispenses.ts src/lib/dispenses/data-access.ts docs/backend/FRONTEND-WIREUP.md
git commit -m "feat(dispenses): API client and wireup docs"
```

---

### Task 7: Page UI + nav + dashboard CTA

**Files:**
- Create: `src/app/dispensing-dispatch/page.tsx`
- Create: `src/app/dispensing-dispatch/nav.ts`
- Create: `src/app/dispensing-dispatch/dispensing-dispatch-view.tsx`
- Modify: `src/lib/nav/app-nav.ts`
- Modify: `src/app/dashboard/dashboard-view.tsx`
- Modify: `src/components/layout/app-shell-page-fallback.tsx` if `activeNavId` union needs update

**UX checklist (Stitch):**
- H1 / banner title: `میز کار نسخه‌پیچی و صدور حواله خروج کالا`
- FEFO badge + educational banner
- Barcode text field + drug search (reuse `listDrugs` / existing drugs API search)
- Line cards: normal / cold / controlled styling; qty steppers; controlled form fields
- Patient panel + summary totals + confirm button disabled unless `canConfirmDispense`
- Print buttons → `toast.info('در این نسخه فعال نیست.')`
- `?orderId=` resume; on first add without id → `createDispense` then `router.replace`
- After confirm: toast + read-only; link shelf/cardex

Nav:

```ts
{
  id: 'dispensing',
  label: 'حواله خروج و فروش',
  href: '/dispensing-dispatch',
  icon: 'local_shipping', // or existing icon name closest to outbound
}
```

Dashboard button: `router.push('/dispensing-dispatch')` instead of toast.

- [ ] **Step 1: Update `AppNavId` + `getAppNavItems`**
- [ ] **Step 2: Implement page + view** (compose existing Button, Input, Card, toast, AppShell patterns from invoice-receipts-view)
- [ ] **Step 3: Wire dashboard CTA**
- [ ] **Step 4: Manual visual check against stitch screenshot**
- [ ] **Step 5: Commit** (if requested)

```bash
git add src/app/dispensing-dispatch/ src/lib/nav/app-nav.ts src/app/dashboard/dashboard-view.tsx
git commit -m "feat(dispensing-dispatch): workstation UI and navigation"
```

---

### Task 8: E2E happy path

**Files:**
- Create: `tests/e2e/dispensing-dispatch.spec.ts`

**Flow:**
1. Assume auth fixture/storage from other e2e (copy login helper from `login.spec.ts` / existing pattern)
2. `page.goto('/dispensing-dispatch')`
3. Expect heading `میز کار نسخه‌پیچی و صدور حواله خروج کالا`
4. Search/add `آموکسی` or seed drug → line appears with FEFO batch
5. Fill patient name if empty
6. Click confirm CTA
7. Expect success toast / `orderNo` / read-only state
8. Optional: open shelf or cardex and assert qty dropped for `drug-amox` batch

- [ ] **Step 1: Write spec**
- [ ] **Step 2: Run with API+Mongo+Next up**

Run: `cd 02-project/app && pnpm exec playwright test tests/e2e/dispensing-dispatch.spec.ts`  
Expected: PASS

- [ ] **Step 3: Commit** (if requested)

```bash
git add tests/e2e/dispensing-dispatch.spec.ts
git commit -m "test(e2e): dispensing-dispatch confirm happy path"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Draft→confirm Mongo order | 3–5 |
| FEFO default + manual reason | 2–4 |
| Controlled gates | 1, 4, 7 |
| Patient name required | 1, 4 |
| Financial totals / technical fee | 1, 3, 7 |
| clear-lines + fefo-preview | 3, 5, 6 |
| Cardex + audit outbound | 4 |
| Persian headings + sidebar | 7 |
| No receipt/transfer edits | Global + file map |
| Unit + e2e tests | 1–2, 4, 8 |
| FRONTEND-WIREUP | 6 |

No TBD/placeholders left in task steps. Types use `consumerPrice` consistently on the client; server JSON field must be `consumerPrice` (map from batch `ConsumerPriceRial` in service).
