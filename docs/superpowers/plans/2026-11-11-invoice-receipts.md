# Invoice Receipts (`invoice-receipts`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/invoice-receipts` — a three-step inbound purchase-invoice wizard that persists Mongo drafts and creates live stock only on confirm.

**Architecture:** New Go package `internal/receipt` owns `InvoiceReceipt` documents (`draft` → `confirmed`). Confirm orchestrates existing shelf/cardex/audit services after extracting a shared “insert batch + cardex inbound” helper from `expiry.Service.Create` (audit stays with the caller). Next.js wizard reuses `Stepper`, AppShell, and the existing API facade pattern.

**Tech Stack:** Go + Echo + MongoDB, Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, existing PharmaStock design system.

**Spec:** `docs/superpowers/specs/2026-11-11-invoice-receipts-design.md`  
**Visual SoT:** `docs/stitch-reference/screens/invoice-receipts/`

## Global Constraints

- App code only under `02-project/app/`.
- Persian main headings on the business page; RTL; integer Rial; ISO dates in API.
- No real secrets or committed `.env` (`.env.example` placeholders only).
- Do not edit `README.md`, `BRIEF.md`, `templates/`, or `tools/export-agent-logs.py`.
- Keep `POST /expiry-batches` working; do not invent Excel reconciliation.
- Working directories: frontend commands from `02-project/app`; Go from `02-project/app/backend`.
- Frontend tests: `pnpm test`; Go: `go test ./...`; e2e needs Mongo + API + Next.

## File map

| File | Responsibility |
|------|----------------|
| `backend/internal/expiry/batch_create.go` | Shared insert batch + cardex inbound (no audit) |
| `backend/internal/expiry/service.go` | Refactor `Create` to use helper + own `stock_in` audit |
| `backend/internal/shelf/repository.go` | Add `DeleteBatch` for confirm rollback |
| `backend/pkg/database/mongo.go` | Index `invoice_receipts` |
| `backend/internal/receipt/entity.go` | `Receipt`, `Header`, `Line`, statuses |
| `backend/internal/receipt/repository.go` | Mongo CRUD for receipts |
| `backend/internal/receipt/totals.go` | Pure gross/net helpers |
| `backend/internal/receipt/service.go` | Create/Get/List/Patch/Lines/Confirm |
| `backend/internal/receipt/handler.go` | HTTP handlers |
| `backend/internal/receipt/service_test.go` | Go unit tests (fakes) |
| `backend/cmd/api/bootstrap/app.go` | Wire receipt deps |
| `backend/cmd/api/bootstrap/routes.go` | Register `/receipts*` |
| `backend/internal/seed/seed.go` | Optional sample draft receipt |
| `src/lib/types/receipts.ts` | Frontend types |
| `src/lib/receipts/totals.ts` | Client totals + step gating helpers |
| `src/lib/api/receipts.ts` | HTTP client |
| `src/lib/receipts/data-access.ts` | DAL facade |
| `src/app/invoice-receipts/page.tsx` | Route shell |
| `src/app/invoice-receipts/invoice-receipts-view.tsx` | Wizard UI |
| `src/lib/nav/app-nav.ts` | Sidebar entry |
| `src/app/dashboard/dashboard-view.tsx` | CTA → `/invoice-receipts` |
| `tests/unit/receipts/totals.test.ts` | Totals/gating unit tests |
| `tests/e2e/invoice-receipts.spec.ts` | Playwright happy path |
| `docs/backend/FRONTEND-WIREUP.md` | Document new endpoints |

---

### Task 1: Client totals + step gating (TDD)

**Files:**
- Create: `src/lib/types/receipts.ts`
- Create: `src/lib/receipts/totals.ts`
- Test: `tests/unit/receipts/totals.test.ts`

**Interfaces:**
- Produces:
  - Types: `ReceiptStatus`, `PurchaseType`, `ReceiptHeader`, `ReceiptLine`, `InvoiceReceipt`, `ReceiptTotals`
  - `computeReceiptTotals(lines, discountRial, vatRial): ReceiptTotals`
  - `canAdvanceToStep3(lines): boolean` — every line has drugId, batchNo, expiry, quantity > 0
  - `canConfirmReceipt(receipt): boolean` — draft + ≥1 line + every line has `locationLabel` or `binId`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  canAdvanceToStep3,
  canConfirmReceipt,
  computeReceiptTotals,
} from '@/lib/receipts/totals'
import type { InvoiceReceipt, ReceiptLine } from '@/lib/types/receipts'

const line = (over: Partial<ReceiptLine> = {}): ReceiptLine => ({
  id: 'l1',
  drugId: 'drug-amox',
  nameFa: 'آموکسی‌سیلین',
  batchNo: 'B1',
  expiry: '2027-01-01',
  quantity: 10,
  unitLabel: 'عدد',
  buyPriceRial: 1000,
  ...over,
})

describe('computeReceiptTotals', () => {
  it('computes gross and net', () => {
    expect(
      computeReceiptTotals(
        [line({ quantity: 10, buyPriceRial: 1000 }), line({ id: 'l2', quantity: 5, buyPriceRial: 2000 })],
        1500,
        0,
      ),
    ).toEqual({ grossRial: 20000, discountRial: 1500, vatRial: 0, netRial: 18500 })
  })
})

describe('canConfirmReceipt', () => {
  it('requires shelf on every line', () => {
    const base: InvoiceReceipt = {
      id: 'r1',
      status: 'draft',
      currentStep: 3,
      header: {
        invoiceNo: 'F-1',
        distributor: 'پخش',
        issuedAt: '2024-11-11',
        receivedAt: '2024-11-11',
        warehouseLabel: 'مرکزی',
        purchaseType: 'official_ttac',
        discountRial: 0,
        vatRial: 0,
      },
      lines: [line({ locationLabel: 'B-12' })],
      createdBy: { userId: 'u1', name: 'اپراتور', role: 'warehouse_operator' },
      createdAt: '',
      updatedAt: '',
    }
    expect(canConfirmReceipt(base)).toBe(true)
    expect(canConfirmReceipt({ ...base, lines: [line()] })).toBe(false)
  })
})

describe('canAdvanceToStep3', () => {
  it('needs at least one complete line', () => {
    expect(canAdvanceToStep3([])).toBe(false)
    expect(canAdvanceToStep3([line()])).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm exec vitest run tests/unit/receipts/totals.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement types + helpers**

```ts
// src/lib/types/receipts.ts
export type ReceiptStatus = 'draft' | 'confirmed' | 'cancelled'
export type PurchaseType = 'official_ttac' | 'official' | 'other'

export type ReceiptHeader = {
  invoiceNo: string
  distributor: string
  issuedAt: string
  receivedAt: string
  warehouseLabel: string
  purchaseType: PurchaseType
  discountRial: number
  vatRial: number
  note?: string
}

export type ReceiptLine = {
  id: string
  drugId: string
  nameFa: string
  gtin?: string
  irc?: string
  batchNo: string
  expiry: string
  quantity: number
  unitLabel: string
  buyPriceRial: number
  consumerPriceRial?: number
  locationLabel?: string
  binId?: string
  zone?: string
}

export type InvoiceReceipt = {
  id: string
  status: ReceiptStatus
  currentStep: 1 | 2 | 3
  header: ReceiptHeader
  lines: ReceiptLine[]
  createdBatchIds?: string[]
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
  grossRial?: number
  netRial?: number
}

export type ReceiptTotals = {
  grossRial: number
  discountRial: number
  vatRial: number
  netRial: number
}
```

```ts
// src/lib/receipts/totals.ts
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
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm exec vitest run tests/unit/receipts/totals.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/receipts.ts src/lib/receipts/totals.ts tests/unit/receipts/totals.test.ts
git commit -m "$(cat <<'EOF'
feat(receipts): add client totals and confirm gating helpers

EOF
)"
```

---

### Task 2: Go totals helper (TDD)

**Files:**
- Create: `backend/internal/receipt/totals.go`
- Test: `backend/internal/receipt/totals_test.go`

**Interfaces:**
- Produces: `func ComputeTotals(lines []Line, discount, vat int64) (gross, net int64)`

- [ ] **Step 1: Write failing test**

```go
package receipt

import "testing"

func TestComputeTotals(t *testing.T) {
	gross, net := ComputeTotals([]Line{
		{Quantity: 10, BuyPriceRial: 1000},
		{Quantity: 5, BuyPriceRial: 2000},
	}, 1500, 0)
	if gross != 20000 || net != 18500 {
		t.Fatalf("got gross=%d net=%d", gross, net)
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && go test ./internal/receipt -run TestComputeTotals -count=1`  
Expected: FAIL (package/types missing)

- [ ] **Step 3: Minimal types + totals**

```go
// backend/internal/receipt/entity.go (minimal fields needed now; expand in Task 4)
package receipt

type Line struct {
	ID                string `bson:"id" json:"id"`
	DrugID            string `bson:"drugId" json:"drugId"`
	NameFa            string `bson:"nameFa" json:"nameFa"`
	GTIN              string `bson:"gtin,omitempty" json:"gtin,omitempty"`
	IRC               string `bson:"irc,omitempty" json:"irc,omitempty"`
	BatchNo           string `bson:"batchNo" json:"batchNo"`
	Expiry            string `bson:"expiry" json:"expiry"`
	Quantity          int    `bson:"quantity" json:"quantity"`
	UnitLabel         string `bson:"unitLabel" json:"unitLabel"`
	BuyPriceRial      int64  `bson:"buyPriceRial" json:"buyPriceRial"`
	ConsumerPriceRial int64  `bson:"consumerPriceRial,omitempty" json:"consumerPriceRial,omitempty"`
	LocationLabel     string `bson:"locationLabel,omitempty" json:"locationLabel,omitempty"`
	BinID             string `bson:"binId,omitempty" json:"binId,omitempty"`
	Zone              string `bson:"zone,omitempty" json:"zone,omitempty"`
}
```

```go
// backend/internal/receipt/totals.go
package receipt

func ComputeTotals(lines []Line, discount, vat int64) (gross, net int64) {
	for _, l := range lines {
		gross += int64(l.Quantity) * l.BuyPriceRial
	}
	if discount < 0 {
		discount = 0
	}
	if vat < 0 {
		vat = 0
	}
	return gross, gross - discount + vat
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && go test ./internal/receipt -run TestComputeTotals -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/receipt/entity.go backend/internal/receipt/totals.go backend/internal/receipt/totals_test.go
git commit -m "$(cat <<'EOF'
feat(receipts): add Go receipt totals helper

EOF
)"
```

---

### Task 3: Shared batch create + DeleteBatch

**Files:**
- Create: `backend/internal/expiry/batch_create.go`
- Modify: `backend/internal/expiry/service.go` (`Create` body)
- Modify: `backend/internal/shelf/repository.go` (add `DeleteBatch`)
- Test: `backend/internal/expiry/batch_create_test.go` (optional table for validation fields) OR rely on existing create path via compile + `go test ./internal/expiry ./internal/shelf`

**Interfaces:**
- Produces:
  - `shelf.Repository.DeleteBatch(ctx, id string) error`
  - `expiry.Service.CreateBatchCore(ctx, req CreateRequest, actorName string) (shelf.StockBatch, error)` — inserts batch + cardex inbound; **no audit**
- Consumes: existing `shelf.Repository.InsertBatch`, `drug.Repository.Get`, `cardex.Service.Append`

- [ ] **Step 1: Add `DeleteBatch`**

```go
func (r *Repository) DeleteBatch(ctx context.Context, id string) error {
	_, err := r.batches.DeleteOne(ctx, bson.M{"_id": id})
	return err
}
```

- [ ] **Step 2: Extract `CreateBatchCore`**

Move the validation + drug resolve + `InsertBatch` + `cardex.Append` from `Service.Create` into:

```go
func (s *Service) CreateBatchCore(ctx context.Context, req CreateRequest, actorName string) (shelf.StockBatch, error) {
	// same validation and batch build as current Create
	// InsertBatch + cardex Append with Note including batch number
	// return batch — do NOT call audit
}
```

Refactor `Create` to:

```go
func (s *Service) Create(ctx context.Context, req CreateRequest, actor requestctx.Actor, ip string) (shelf.StockBatch, error) {
	b, err := s.CreateBatchCore(ctx, req, actor.Name)
	if err != nil {
		return shelf.StockBatch{}, err
	}
	_, _ = s.audit.Append(ctx, audit.AppendInput{
		Actor: audit.Actor{ID: actor.UserID, Name: actor.Name, Role: actor.Role, Initials: actor.Initials},
		Action: "stock_in", EntityType: "batch", EntityID: b.ID, EntityLabel: b.NameFa + " / " + b.BatchNo,
		Description: "ثبت سری ساخت جدید", After: map[string]any{"batchNo": b.BatchNo, "quantity": b.Quantity},
		IP: ip, BranchID: actor.BranchID, IsControlledSubstance: b.IsControlled,
	})
	return b, nil
}
```

- [ ] **Step 3: Verify compile + domain tests**

Run: `cd backend && go test ./internal/expiry ./internal/shelf ./pkg/domain -count=1`  
Expected: PASS (or compile-clean if no expiry tests)

- [ ] **Step 4: Commit**

```bash
git add backend/internal/expiry/service.go backend/internal/expiry/batch_create.go backend/internal/shelf/repository.go
git commit -m "$(cat <<'EOF'
refactor(expiry): extract CreateBatchCore and add DeleteBatch for rollback

EOF
)"
```


---

### Task 4: Receipt entity, repository, indexes

**Files:**
- Modify: `backend/internal/receipt/entity.go` (full model)
- Create: `backend/internal/receipt/repository.go`
- Modify: `backend/pkg/database/mongo.go` (indexes for `invoice_receipts`)

**Interfaces:**
- Produces:
  - `Receipt` with `Header`, `[]Line`, status, steps, `CreatedBatchIDs`, actor snapshot, timestamps
  - `Repository`: `Insert`, `Get`, `List(status, page, pageSize)`, `Replace`, `UpdateStatus`
  - Collection name: `invoice_receipts`

- [ ] **Step 1: Complete entity**

```go
const (
	StatusDraft     = "draft"
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

type Header struct {
	InvoiceNo      string `bson:"invoiceNo" json:"invoiceNo"`
	Distributor    string `bson:"distributor" json:"distributor"`
	IssuedAt       string `bson:"issuedAt" json:"issuedAt"`
	ReceivedAt     string `bson:"receivedAt" json:"receivedAt"`
	WarehouseLabel string `bson:"warehouseLabel" json:"warehouseLabel"`
	PurchaseType   string `bson:"purchaseType" json:"purchaseType"`
	DiscountRial   int64  `bson:"discountRial" json:"discountRial"`
	VatRial        int64  `bson:"vatRial" json:"vatRial"`
	Note           string `bson:"note,omitempty" json:"note,omitempty"`
}

type CreatedBy struct {
	UserID string `bson:"userId" json:"userId"`
	Name   string `bson:"name" json:"name"`
	Role   string `bson:"role" json:"role"`
}

type Receipt struct {
	ID              string    `bson:"_id" json:"id"`
	Status          string    `bson:"status" json:"status"`
	CurrentStep     int       `bson:"currentStep" json:"currentStep"`
	Header          Header    `bson:"header" json:"header"`
	Lines           []Line    `bson:"lines" json:"lines"`
	CreatedBatchIDs []string  `bson:"createdBatchIds,omitempty" json:"createdBatchIds,omitempty"`
	CreatedBy       CreatedBy `bson:"createdBy" json:"createdBy"`
	CreatedAt       time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time `bson:"updatedAt" json:"updatedAt"`
	ConfirmedAt     *time.Time `bson:"confirmedAt,omitempty" json:"confirmedAt,omitempty"`
}
```

- [ ] **Step 2: Repository** — standard Mongo patterns from `reorder`/`audit` repos (`InsertOne`, `FindOne` by `_id`, `Find` with status filter + pagination, `ReplaceOne`).

- [ ] **Step 3: Indexes in `EnsureIndexes`**

```go
{"invoice_receipts", []mongo.IndexModel{
	{Keys: bson.D{{Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}},
	{Keys: bson.D{{Key: "header.invoiceNo", Value: 1}}},
}},
```

- [ ] **Step 4: Compile**

Run: `cd backend && go test ./internal/receipt ./pkg/database -count=1`  
Expected: PASS / compile OK

- [ ] **Step 5: Commit**

```bash
git add backend/internal/receipt backend/pkg/database/mongo.go
git commit -m "$(cat <<'EOF'
feat(receipts): add InvoiceReceipt Mongo entity and repository

EOF
)"
```

---

### Task 5: Receipt service — draft CRUD + lines (TDD)

**Files:**
- Create: `backend/internal/receipt/service.go`
- Create: `backend/internal/receipt/dto.go`
- Test: `backend/internal/receipt/service_test.go` (in-memory fake repo)

**Interfaces:**
- Consumes: `Repository`, `drug.Repository` (for line nameFa resolve on add)
- Produces:
  - `Create(ctx, header, actor) (ReceiptView, error)`
  - `Get(ctx, id) (ReceiptView, error)`
  - `List(ctx, status, pagination) (...)`
  - `Patch(ctx, id, patch) (ReceiptView, error)` — draft only
  - `AddLine` / `PatchLine` / `DeleteLine` — draft only
  - `ReceiptView` embeds receipt fields + `GrossRial` / `NetRial`

**Validation (Persian messages via `errormap.Validation`):**
- Header create: `invoiceNo`, `distributor`, `issuedAt`, `receivedAt`, `warehouseLabel` required; `purchaseType` in allowed set
- Line: `drugId`, `batchNo`, `expiry`, `quantity > 0` required

- [ ] **Step 1: Write failing service tests** for:
  1. Create draft → status draft, step 1, empty lines
  2. AddLine then ComputeTotals reflected on Get
  3. PatchLine location
  4. Mutating confirmed receipt returns error (use a pre-seeded confirmed doc in fake)

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && go test ./internal/receipt -count=1`  
Expected: FAIL

- [ ] **Step 3: Implement service methods** (no Confirm yet)

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && go test ./internal/receipt -count=1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/receipt
git commit -m "$(cat <<'EOF'
feat(receipts): implement draft receipt CRUD and line mutations

EOF
)"
```

---

### Task 6: Confirm + HTTP handlers + wiring

**Files:**
- Modify: `backend/internal/receipt/service.go` (`Confirm`)
- Create: `backend/internal/receipt/handler.go`
- Modify: `backend/cmd/api/bootstrap/app.go`
- Modify: `backend/cmd/api/bootstrap/routes.go`
- Modify: `backend/internal/receipt/service_test.go` (confirm cases)
- Optional: `backend/internal/seed/seed.go` sample draft

**Interfaces:**
- Consumes: `expiry.Service.CreateBatchCore`, `shelf.Repository.DeleteBatch`, `audit.Service.Append`
- Produces: `Confirm(ctx, id, actor, ip) (ReceiptView, error)`
- Routes under JWT group:
  - `POST /receipts`
  - `GET /receipts`
  - `GET /receipts/:id`
  - `PATCH /receipts/:id`
  - `POST /receipts/:id/lines`
  - `PATCH /receipts/:id/lines/:lineId`
  - `DELETE /receipts/:id/lines/:lineId`
  - `POST /receipts/:id/confirm`

**Confirm algorithm (exact):**
1. Load receipt; if missing → 404; if not draft → 409 (`errormap` conflict if available, else Validation/generic mapped to 409 in handler)
2. If `len(lines)==0` → 400
3. For each line without `locationLabel` and `binId` → 400 field map
4. `created := []string{}`
5. For each line call `CreateBatchCore` with `CreateRequest` filled from line + header (`InvoiceNo`, `Distributor`, prices, location)
6. On error: for each id in `created` call `DeleteBatch`; return error; leave draft
7. On success: audit `stock_receipt` once; set status confirmed, `CreatedBatchIDs`, `ConfirmedAt`; `Replace`

- [ ] **Step 1: Add confirm unit tests** (fake expiry core injectable OR interface)
  Prefer: define small interface on receipt service:

```go
type BatchCreator interface {
	CreateBatchCore(ctx context.Context, req expiry.CreateRequest, actorName string) (shelf.StockBatch, error)
}
```

Fake can succeed/fail; assert rollback deletes called.

- [ ] **Step 2: Implement Confirm + Handler (mirror expiry handler style with `requestctx.Get`)**

- [ ] **Step 3: Wire in `bootstrap.New`:**

```go
receiptRepo := receipt.NewRepository(mongo.DB)
receiptSvc := receipt.NewService(receiptRepo, drugRepo, expirySvc, shelfRepo, auditSvc)
receiptH := receipt.NewHandler(receiptSvc)
// add Receipt: receiptH to RegisterRoutes
```

- [ ] **Step 4: Run tests**

Run: `cd backend && go test ./internal/receipt ./cmd/api/bootstrap -count=1`  
Expected: PASS

- [ ] **Step 5: Manual smoke (optional if Mongo up)**

```bash
# login then:
curl -s -X POST "$API/api/v1/receipts" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"invoiceNo":"F-TEST","distributor":"پخش","issuedAt":"2024-11-11","receivedAt":"2024-11-11","warehouseLabel":"مرکزی","purchaseType":"official_ttac"}'
```

- [ ] **Step 6: Commit**

```bash
git add backend/internal/receipt backend/cmd/api/bootstrap backend/internal/seed
git commit -m "$(cat <<'EOF'
feat(receipts): confirm intake and expose /api/v1/receipts endpoints

EOF
)"
```

---

### Task 7: Frontend API client + DAL

**Files:**
- Create: `src/lib/api/receipts.ts`
- Create: `src/lib/receipts/data-access.ts`
- Modify: `src/lib/types/index.ts` (export receipts types if barrel used)
- Modify: `docs/backend/FRONTEND-WIREUP.md` (document endpoints)

**Interfaces:**
- Produces async functions mirroring backend:
  - `createReceipt(header)`, `getReceipt(id)`, `listReceipts({status})`, `patchReceipt(id, body)`
  - `addReceiptLine(id, line)`, `patchReceiptLine(id, lineId, patch)`, `deleteReceiptLine(id, lineId)`
  - `confirmReceipt(id)`
- Use `apiRequest` from `src/lib/api/http.ts` with `auth: true`

- [ ] **Step 1: Implement `src/lib/api/receipts.ts`** mapping JSON ↔ `InvoiceReceipt` (include `grossRial`/`netRial` from server when present; else `computeReceiptTotals` client-side)

- [ ] **Step 2: Thin `data-access.ts` re-exports** (same pattern as `src/lib/expiry/data-access.ts`)

- [ ] **Step 3: Update FRONTEND-WIREUP.md** with the `/receipts` table

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/receipts.ts src/lib/receipts/data-access.ts src/lib/types docs/backend/FRONTEND-WIREUP.md
git commit -m "$(cat <<'EOF'
feat(receipts): wire frontend API client for invoice receipts

EOF
)"
```

---

### Task 8: Wizard UI page

**Files:**
- Create: `src/app/invoice-receipts/page.tsx`
- Create: `src/app/invoice-receipts/invoice-receipts-view.tsx`
- Modify: `src/lib/nav/app-nav.ts`
- Modify: `src/app/dashboard/dashboard-view.tsx`

**UX requirements:**
- Title: «ورود فاکتور و رسید انبار»
- Subtitle matching Stitch intent
- `Stepper` with the three Persian step labels from the spec
- Step 1 form fields for header; primary saves draft and advances
- Step 2 scan/add form + `DenseDataTable` of lines + totals strip
- Step 3 shelf fields per line + Confirm button gated by `canConfirmReceipt`
- `?receiptId=` loads draft on mount
- After confirm: `toast.success` + disable edits
- Dashboard button: `router.push('/invoice-receipts')` instead of toast
- Nav: add `receipts` id with `receipt_long` or `post_add` icon and href `/invoice-receipts`

- [ ] **Step 1: Extend `AppNavId` + `getAppNavItems`**

```ts
| 'receipts'
// item:
{
  id: 'receipts',
  label: 'ورود فاکتور و رسید انبار',
  href: '/invoice-receipts',
  icon: 'receipt_long',
}
```

- [ ] **Step 2: Build page + view** composing existing DS (`AppShell`, `Button`, `Input`, `DenseDataTable`, `Stepper`, `sonner`). Keep visual structure close to Stitch screenshot (summary card, scan desk, lines table, footer actions).

- [ ] **Step 3: Dashboard CTA**

```tsx
onClick={() => router.push('/invoice-receipts')}
```

- [ ] **Step 4: Typecheck / unit**

Run: `pnpm exec tsc --noEmit` (or project’s usual check) and `pnpm exec vitest run tests/unit/receipts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/invoice-receipts src/lib/nav/app-nav.ts src/app/dashboard/dashboard-view.tsx
git commit -m "$(cat <<'EOF'
feat(receipts): add three-step invoice receipts wizard UI

EOF
)"
```

---

### Task 9: E2E coverage

**Files:**
- Create: `tests/e2e/invoice-receipts.spec.ts`

**Flow:**
1. Login (reuse helpers from `tests/e2e/login.spec.ts` / existing auth helper if any)
2. Open `/invoice-receipts`
3. Fill header → continue
4. Add one line with a known seeded drug id (e.g. `drug-amox`)
5. Assign shelf (e.g. `B-12`)
6. Confirm
7. Assert success toast or confirmed state; optionally open `/expiry-alerts-fefo` and see new batch / invoice number

- [ ] **Step 1: Write Playwright spec** with `data-testid` hooks added in Task 8 if needed (`receipt-stepper`, `receipt-confirm`, `receipt-add-line`)

- [ ] **Step 2: Run with stack up**

```bash
# Mongo + API + Next running per FRONTEND-WIREUP.md
pnpm exec playwright test tests/e2e/invoice-receipts.spec.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/invoice-receipts.spec.ts src/app/invoice-receipts
git commit -m "$(cat <<'EOF'
test(receipts): add e2e happy path for invoice receipt confirm

EOF
)"
```

---

### Task 10: Spec status + wireup polish

**Files:**
- Modify: `docs/superpowers/specs/2026-11-11-invoice-receipts-design.md` (Status → Implemented)
- Modify: `docs/backend/FRONTEND-WIREUP.md` if anything drifted
- Optional: seed one draft in `backend/internal/seed/seed.go`

- [ ] **Step 1: Mark design status Implemented; note plan path**
- [ ] **Step 2: Final verification**

```bash
cd backend && go test ./...
cd ../ && pnpm exec vitest run tests/unit/receipts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-11-11-invoice-receipts-design.md docs/backend/FRONTEND-WIREUP.md backend/internal/seed
git commit -m "$(cat <<'EOF'
docs(receipts): mark invoice-receipts design implemented

EOF
)"
```

---

## Spec coverage self-check

| Spec section | Task(s) |
|--------------|---------|
| 3-step wizard UX | 8 |
| Mongo InvoiceReceipt draft→confirm | 4, 5, 6 |
| API table | 6, 7 |
| Confirm rules + rollback | 6 |
| Shared batch create, no audit in helper | 3 |
| Nav + dashboard CTA | 8 |
| Totals server + client | 1, 2, 5 |
| Tests unit + e2e | 1, 2, 5, 6, 9 |
| Out of scope Excel/RBAC/cancel API | respected (no tasks) |

## Placeholder / consistency notes

- Money fields: `int64` on Go / `number` on TS (integer Rial).
- Helper name locked: `CreateBatchCore`.
- Collection locked: `invoice_receipts`.
- Audit action locked: `stock_receipt` on confirm only.
