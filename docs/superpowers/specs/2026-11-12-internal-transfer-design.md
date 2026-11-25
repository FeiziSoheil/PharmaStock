# Design: `internal-transfer` (انتقال داخلی)

**Date:** 2026-11-12  
**Stage:** Design → Plan → Build  
**Status:** Approved in brainstorming; awaiting user review of this written spec  
**Visual SoT:** `docs/stitch-reference/screens/internal-transfer/` (`screen.html` + `screenshot.png`)  
**Approach:** Dedicated Go `transfer` package + Mongo `InternalTransfer` draft→confirm (Approach 1)

## 1. Goal

Ship a production-shaped internal stock-transfer wizard at `/internal-transfer` that matches the Stitch two-step flow (انتخاب اقلام و تخصیص بَچ → بازبینی، اعتبارسنجی و تایید), keeps Persian main headings, persists drafts in Mongo, and only mutates live stock (batch location/quantity + cardex + audit) on explicit confirm. Backend must orchestrate existing `shelf` / `cardex` / `audit` paths and must not collide with the parallel `invoice-receipts` / `receipt` workstream.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Full 2-step Stitch wizard (lines staging → review/confirm) |
| Persistence | Mongo `InternalTransfer` with `draft` → `confirmed` (`cancelled` reserved, no cancel API in v1) |
| Architecture | New `internal/transfer` package; orchestrates shelf/cardex/audit |
| Partial quantity | Supported: full move vs split (decrement source + new dest batch) |
| Source / dest | Real `bins` / zones from shelf data; display labels for Stitch chrome |
| Soft reservation | None in v1; re-validate available qty at confirm |
| Dual signatures | UI confirmation chrome + JWT actor as sender; optional receiver name text — no real e-sign |
| Hardware scanner | Out of scope; text search / lookup against drugs + source batches |
| Single-batch relocate | Existing `expiry.UpdateLocation` remains for drug-details flows |
| Confirm audit | One `transfer` event on the transfer document; cardex `transfer` per line with qty |
| Rollback on partial confirm | Best-effort restore location/qty changes from the same request; leave transfer `draft` |
| Parallel work | Do not modify `internal/receipt` or invoice-receipts frontend owned by another agent |

## 3. Wizard & UX

### Steps (Stitch labels)

1. **انتخاب اقلام و تخصیص بَچ** — source/dest header + reason, drug/batch FEFO picker, staging lines table  
2. **بازبینی، اعتبارسنجی و تایید** — KPI summary, checklist, save draft / final confirm  

### Frontend

- Route: `/internal-transfer` (optional `?transferId=` to resume a draft)
- Shell: existing `AppShell` + sidebar item «انتقال داخلی»
- Reuse `Stepper` (`src/components/domain/stepper.tsx`)
- Header card: source node, destination node, reason select (`routine_front` | `urgent_rx` | `night_cap` | `fefo_move`)
- Step 1: search drug → list active source batches (FEFO / nearest expiry) → choose qty → require dest bin or location → add/edit/delete lines via line APIs
- Step 2: KPI cards (line count, total units, validation status); checklist checkboxes (client-only gate); primary CTA `POST /transfers/:id/confirm`; secondary «ذخیره به عنوان پیش‌نویس» = `PATCH`
- After confirm: success toast + links to shelf-inventory / drug-details-cardex; transfer becomes read-only
- Navigation between completed steps allowed while `status === draft`

### Persian headings

Main page title and step titles remain Persian (assessment requirement), aligned with Stitch:

- Page: `فرم حواله انتقال داخلی کالا (انبار اصلی به پیشخوان تحویل نسخه)`
- Steps as above

## 4. Data model

### `InternalTransfer`

```ts
{
  id: string
  status: 'draft' | 'confirmed' | 'cancelled'
  currentStep: 1 | 2
  header: {
    reason: 'routine_front' | 'urgent_rx' | 'night_cap' | 'fefo_move'
    sourceZone: string
    destZone: string
    sourceLabel: string
    destLabel: string
    note?: string
    receiverName?: string
  }
  lines: Array<{
    id: string
    drugId: string
    nameFa: string
    batchNo: string
    expiry: string              // ISO YYYY-MM-DD
    sourceBatchId: string
    sourceBinId?: string
    sourceLocationLabel: string
    destBinId?: string
    destLocationLabel?: string  // required (label or bin) before confirm
    quantity: number            // > 0; ≤ available at confirm
    unitLabel: string
    matchStatus: 'barcode' | 'physical'
  }>
  transferNo?: string           // assigned on confirm (e.g. TRF-<jalali-or-iso>-<short>)
  resultBatchIds?: string[]     // dest batch ids created/updated on confirm (for rollback/debug)
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
}
```

### Reason labels (UI)

| Code | Persian |
|------|---------|
| `routine_front` | شارژ روتین پیشخوان نسخه‌پیچی |
| `urgent_rx` | کسری نسخه فوری و بیمار در انتظار |
| `night_cap` | تکمیل سقف موجودی شیفت شب |
| `fefo_move` | جابجایی بر اساس تاریخ انقضای نزدیک (FEFO) |

## 5. API (`/api/v1`, JWT required)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/transfers` | Create draft from header |
| `GET` | `/transfers/:id` | Load transfer |
| `GET` | `/transfers` | List (filter `status`, pagination); resume drafts |
| `PATCH` | `/transfers/:id` | Update header, `currentStep`, note/receiver (draft only) |
| `POST` | `/transfers/:id/lines` | Add line (step 1) |
| `PATCH` | `/transfers/:id/lines/:lineId` | Edit qty / dest / matchStatus (draft only) |
| `DELETE` | `/transfers/:id/lines/:lineId` | Remove line (draft only) |
| `POST` | `/transfers/:id/confirm` | Finalize stock move |

### Line create rules

1. Resolve `sourceBatchId`; copy drug/batch/expiry/source location from live batch  
2. Reject if source batch missing, not active/usable, or `quantity <= 0`  
3. Reject if line `quantity` > current source batch quantity (at add time; re-check on confirm)  
4. Require `destBinId` and/or `destLocationLabel` before confirm (may be set on add or later PATCH)

### Confirm rules

1. Transfer must be `draft`; otherwise **409**  
2. At least one line; every line needs `destLocationLabel` or `destBinId`; otherwise **400** with field map  
3. For each line, re-load source batch and ensure remaining quantity ≥ line quantity; otherwise **400**  
4. For each line:
   - Resolve dest zone/address from `destBinId` when provided (same pattern as `expiry.UpdateLocation`)  
   - If `quantity == source.quantity`: update that batch’s location/bin/zone to destination  
   - If `quantity < source.quantity`: decrement source quantity; insert a new `StockBatch` at destination cloning identity fields (`drugId`, `batchNo`, `expiry`, prices, controlled flags, etc.) with `quantity = line.quantity`  
5. Append cardex `type: transfer` per line with `QtyOut` / `QtyIn` reflecting moved quantity and a note naming source→dest  
6. Append one audit event `action: transfer`, `entityType: transfer`, `entityId: transfer.id`, description including reason + line count  
7. Set `status=confirmed`, `confirmedAt`, `transferNo`, `resultBatchIds`  
8. If any mid-loop failure: best-effort undo location/qty/new-batch changes from this request; keep transfer `draft`; return error  

### Relationship to `expiry.UpdateLocation`

- Keep `PATCH`-style single-batch relocate on expiry/drug-details unchanged  
- Transfer confirm may call shared shelf helpers (`UpdateBatchLocation`, quantity update, insert batch) rather than duplicating Mongo writes  
- Do **not** require the other agent’s `receipt` package

## 6. Backend package layout

```
backend/internal/transfer/
  entity.go
  repository.go
  service.go
  handler.go
  dto.go
```

Wire in `bootstrap/app.go` + `routes.go`. Index Mongo collection `internal_transfers`. Optional seed: one sample `draft` transfer for demos.

Shelf repository may need small additive helpers if missing (e.g. `UpdateBatchQuantity`, insert clone) — prefer extending `shelf`/`expiry` helpers over copying batch BSON logic into transfer.

## 7. Frontend wiring

- `src/lib/types/transfers.ts`
- `src/lib/api/transfers.ts` + `src/lib/transfers/data-access.ts` (same facade pattern as receipts/drugs)
- `src/lib/transfers/gating.ts` — `canAdvanceToStep2`, `canConfirmTransfer`
- Route: `src/app/internal-transfer/page.tsx` + `internal-transfer-view.tsx`
- Update `src/lib/nav/app-nav.ts` with `AppNavId` + sidebar entry
- Document endpoints in `docs/backend/FRONTEND-WIREUP.md`
- Source batch listing: reuse existing drugs/shelf/expiry list APIs; add a thin transfer-specific query only if FEFO-by-drug-at-source is awkward with current endpoints

## 8. Errors

- Validation: `errormap.Validation` with Persian field messages  
- Not found: 404  
- Confirm conflict: 409  
- Auth: existing JWT middleware; client 401 clears session → `/login`

## 9. Testing

| Layer | Coverage |
|-------|----------|
| Go unit | Header/line validation, confirm guards, full-move vs split paths, rollback leave-draft behavior with fakes |
| TS unit | Step gating (`canAdvanceToStep2`, `canConfirmTransfer`) |
| E2E | Create draft → add line with dest → confirm → batch location/qty visible on shelf or drug cardex |

## 10. Out of scope

- Real dual digital signatures / hardware tokens  
- Hard stock locks / reservations while draft  
- `dispensing-dispatch`, `distributor-returns`, `periodic-stocktake`  
- Reversing a `confirmed` transfer  
- Excel / print-specialized slip beyond existing print helpers if already present  
- Changes to `internal/receipt` or `/invoice-receipts` owned by the other agent  
- Mongo multi-document ACID transactions (best-effort rollback instead)

## 11. Success criteria

- Operator can complete Stitch’s two steps end-to-end against Go + Mongo  
- Draft survives refresh via `transferId`  
- Confirm moves or splits stock correctly and writes cardex + `transfer` audit  
- Persian main headings present; sidebar entry works  
- Unit + e2e coverage for happy path and key validation failures  
- No file conflicts with parallel invoice-receipts workstream
