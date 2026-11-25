# Design: `dispensing-dispatch` (نسخه‌پیچی و حواله خروج)

**Date:** 2026-11-12  
**Stage:** Design → Plan → Build  
**Status:** Approved in brainstorming; awaiting user review of this written spec  
**Visual SoT:** `docs/stitch-reference/screens/dispensing-dispatch/` (`screen.html` + `screenshot.png`)  
**Approach:** Dedicated Go `dispensing` package + Mongo `DispenseOrder` draft→confirm (Approach 1)

## 1. Goal

Ship a production-shaped dispensing workstation at `/dispensing-dispatch` that matches the Stitch operational core (scan/search, FEFO allocation, line cards including cold-chain and controlled, patient/Rx side panel, confirm outbound), keeps Persian main headings, persists drafts in Mongo, and only deducts live stock (batch quantity + cardex + audit) on explicit confirm. Backend must orchestrate existing `shelf` / `cardex` / `audit` paths and must not collide with parallel `receipt` / `transfer` workstreams.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Operational core of Stitch (Approach B): FEFO auto-allocate, controlled form when needed, light patient/Rx + fee summary, confirm. No IoT fridge temp, no real insurance network, no specialized print |
| Persistence | Mongo `DispenseOrder` with `draft` → `confirmed` (`cancelled` reserved, no cancel API in v1) |
| Architecture | New `internal/dispensing` package; orchestrates shelf/cardex/audit |
| Batch allocation | Default FEFO (nearest usable expiry). Manual override only with required `manualReason` |
| Controlled lines | Require physician name, recipient national ID, e-Rx tracking id, and `technicalAck=true` before confirm |
| Financials | Sum consumer prices from lines + configurable flat `technicalFee`; `insuranceCover` manual/simple (default 0). No Sepas/SSO live integration |
| Hardware scanner | Out of scope; text barcode / UID / GTIN / name search |
| Soft reservation | None in v1; re-validate available qty at confirm |
| Confirm audit | One `dispensing` (or escalate to `controlled_dispense` if any controlled line) event on the order; cardex outbound per line (`dispensing` or `controlled_dispense`) |
| Patient gate | Confirm requires non-empty `patient.nameFa`; other patient fields optional in v1 |
| Price unit | `consumerPrice` is integer Rial in the same unit as `quantity` (reuse existing batch/drug consumer price field as stored) |
| FEFO preview API | In scope: `GET /dispenses/fefo-preview?drugId=` for manual-batch picker UI (register before `/:id`) |
| Rollback on partial confirm | Best-effort restore quantity changes from the same request; leave order `draft` |
| Parallel work | Do not modify `internal/receipt` or `internal/transfer` owned by other agents |

## 3. UX

### Layout (Stitch-aligned)

1. **Workspace banner** — title «میز کار نسخه‌پیچی و صدور حواله خروج کالا», draft/order number chip, FEFO protocol badge  
2. **Scan & search toolbar** — barcode/UID/GTIN text field + generic/brand search → add line  
3. **FEFO enforcement banner** — educational copy (static)  
4. **Main grid** — line cards (8 cols) + patient/summary rail (4 cols)  
5. **Line cards** — normal / cold-chain styling / controlled (error-border) with qty steppers, FEFO details, optional «تغییر دستی بچ»  
6. **Confirm CTA** — «تایید و صدور حواله خروج قطعی از انبار و کسر کاردکس»

### Frontend

- Route: `/dispensing-dispatch` (optional `?orderId=` to resume a draft)
- Shell: existing `AppShell` + sidebar item «حواله خروج و فروش»
- Header: create draft on first useful action if none; show `orderNo` after confirm (and a temporary draft id chip while drafting)
- Step-less single workspace (unlike receipt/transfer wizards): all editing happens on one screen while `status === draft`
- Add line: resolve drug by id or barcode/GTIN → server picks FEFO batch → returns line with batch/location/price
- Edit line: quantity; manual batch switch + reason; controlled fields when `isControlled`
- Clear all lines; delete single line
- Patient panel: name, national id, insurance label, Rx tracking id (`PATCH`)
- Summary: line counts (total / cold / controlled), goods total, technical fee, insurance cover, patient payable
- Primary CTA: `POST /dispenses/:id/confirm` gated by `canConfirmDispense`
- Secondary print / warehouse-slip buttons: toast «در این نسخه فعال نیست» (no print pipeline)
- After confirm: success toast + links to shelf-inventory / drug-details-cardex; order becomes read-only
- Dashboard CTA «نسخه‌پیچی (POS)» navigates here instead of a stub toast when wiring is ready

### Persian headings

Main page title remains Persian (assessment requirement), aligned with Stitch:

- Page: `میز کار نسخه‌پیچی و صدور حواله خروج کالا`
- Section: `اقلام ثبت شده در این حواله`
- Section: `اطلاعات بیمار و نسخه`
- Section: `خلاصه حواله خروج`

## 4. Data model

### `DispenseOrder`

```ts
{
  id: string
  status: 'draft' | 'confirmed' | 'cancelled'
  orderNo?: string                 // assigned on confirm (e.g. OUT-<short>)
  patient: {
    nameFa: string
    nationalId?: string
    insuranceLabel?: string
    rxTrackingId?: string
  }
  lines: Array<{
    id: string
    drugId: string
    nameFa: string
    nameEn?: string
    irc?: string
    manufacturer?: string
    unitLabel: string
    quantity: number
    consumerPrice: number          // integer Rial; same unit as quantity (from batch/drug)
    batchId: string
    batchNo: string
    expiry: string                 // ISO YYYY-MM-DD
    locationLabel: string
    binId?: string
    allocation: 'fefo' | 'manual'
    manualReason?: string          // required when allocation=manual
    isColdChain: boolean
    isControlled: boolean
    controlled?: {
      physicianName: string
      physicianLicense?: string
      recipientNationalId: string
      eRxTrackingId: string
      technicalAck: boolean
    }
  }>
  fees: {
    technicalFee: number           // flat fee, integer Rial
    insuranceCover: number         // v1: default 0 or manual
  }
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
}
```

### Derived totals (API response and/or client)

- `goodsTotal` = Σ (`quantity * consumerPrice`)
- `patientPayable` = `goodsTotal + technicalFee - insuranceCover` (floor at 0)
- Counts: `lineCount`, `coldCount`, `controlledCount`

### FEFO selection rules

1. Candidate batches for `drugId`: usable/active, quantity > 0, not quarantined/expired  
2. Sort by expiry ascending (nearest first), then by remaining quantity ascending as tie-break  
3. Prefer dispensing-zone / POS bins when multiple equal-expiry candidates exist; otherwise any usable location  
4. On line create, snapshot batch identity fields onto the line  
5. Manual override: client sends target `batchId` + `manualReason`; server validates ownership/drug match and stock

## 5. API (`/api/v1`, JWT required)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/dispenses` | Create draft (optional patient/fees) |
| `GET` | `/dispenses/:id` | Load order |
| `GET` | `/dispenses` | List (filter `status`, pagination); resume drafts |
| `PATCH` | `/dispenses/:id` | Update patient, fees (draft only) |
| `POST` | `/dispenses/:id/lines` | Add line via `drugId` or `barcode`/`gtin` (FEFO) |
| `PATCH` | `/dispenses/:id/lines/:lineId` | Edit qty / manual batch / controlled (draft only) |
| `DELETE` | `/dispenses/:id/lines/:lineId` | Remove line (draft only) |
| `POST` | `/dispenses/:id/clear-lines` | Remove all lines (draft only) |
| `POST` | `/dispenses/:id/confirm` | Finalize outbound deduction |
| `GET` | `/dispenses/fefo-preview` | `?drugId=` FEFO candidate(s) for manual picker (route before `/:id`) |

### Line create body (examples)

```ts
{ drugId: string, quantity?: number }           // default quantity 1
{ barcode: string, quantity?: number }          // resolve to drug then FEFO
{ gtin: string, quantity?: number }
```

### Confirm rules

1. Order must be `draft`; otherwise **409**  
2. `patient.nameFa` must be non-empty; otherwise **400**  
3. At least one line; every line `quantity > 0`; otherwise **400**  
4. Every `isControlled` line must have complete `controlled` + `technicalAck === true`; otherwise **400** with field map  
5. Every `allocation === 'manual'` line must have non-empty `manualReason`  
6. For each line, re-load batch and ensure remaining quantity ≥ line quantity; otherwise **400**  
7. For each line: decrement batch quantity (deactivate/zero-handle per existing shelf conventions if qty hits 0); append cardex with `QtyOut = quantity`, type `dispensing` or `controlled_dispense`  
8. Append one audit event: `dispensing` if no controlled lines, else `controlled_dispense`; `entityType: dispense`, `entityId: order.id`  
9. Set `status=confirmed`, `confirmedAt`, `orderNo`  
10. If any mid-loop failure: best-effort undo quantity changes from this request; keep order `draft`; return error  

## 6. Backend package layout

```
backend/internal/dispensing/
  entity.go
  repository.go
  service.go
  handler.go
  dto.go
```

Wire in `bootstrap/app.go` + `routes.go`. Index Mongo collection `dispense_orders`. Optional seed: one sample `draft` order for demos.

Shelf repository may need small additive helpers if missing (e.g. `UpdateBatchQuantity`) — prefer extending `shelf`/`expiry` helpers over copying batch BSON logic into dispensing. Do **not** require or modify the parallel `receipt` / `transfer` packages.

## 7. Frontend wiring

- `src/lib/types/dispenses.ts`
- `src/lib/api/dispenses.ts` + `src/lib/dispenses/data-access.ts` (same facade pattern as receipts/drugs)
- `src/lib/dispenses/gating.ts` — `canConfirmDispense`, line/controlled validators
- Route: `src/app/dispensing-dispatch/page.tsx` + `dispensing-dispatch-view.tsx` + `nav.ts`
- Update `src/lib/nav/app-nav.ts` with `AppNavId` + sidebar entry «حواله خروج و فروش»
- Document endpoints in `docs/backend/FRONTEND-WIREUP.md`
- Drug search: reuse existing drugs list/search APIs; barcode path may reuse TTAC lookup only if already available without expanding TTAC scope on this page

## 8. Errors

- Validation: `errormap.Validation` with Persian field messages  
- Not found: 404  
- Confirm conflict: 409  
- Auth: existing JWT middleware; client 401 clears session → `/login`

## 9. Testing

| Layer | Coverage |
|-------|----------|
| Go unit | FEFO pick ordering, line validation, controlled gates, confirm shortage, rollback leaves draft |
| TS unit | `canConfirmDispense` (empty lines, incomplete controlled, happy path) |
| E2E | Create draft → add FEFO line → confirm → batch qty reduced on shelf or cardex outbound visible |

## 10. Out of scope

- Real dual digital signatures / hardware tokens  
- Hard stock locks / reservations while draft  
- Live insurance / Sepas settlement  
- Fridge IoT temperature telemetry (cold badge may be static from drug/batch flags)  
- Hardware barcode scanners  
- Specialized receipt/print pipeline (buttons may stub)  
- Reversing a `confirmed` dispense  
- `distributor-returns`, `periodic-stocktake`, `controlled-substances-ledger` full pages  
- Changes to `internal/receipt` or `internal/transfer` owned by other agents  
- Mongo multi-document ACID transactions (best-effort rollback instead)

## 11. Success criteria

- Operator can complete Stitch’s operational core end-to-end against Go + Mongo  
- Draft survives refresh via `orderId`  
- Confirm deducts stock correctly and writes cardex + audit (`dispensing` / `controlled_dispense`)  
- Controlled lines block confirm until legal fields + technical ack are complete  
- Persian main headings present; sidebar entry works  
- Unit + e2e coverage for happy path and key validation failures  
- No file conflicts with parallel receipt/transfer workstreams
