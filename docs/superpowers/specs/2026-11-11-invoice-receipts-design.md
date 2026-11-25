# Design: `invoice-receipts` (ورود فاکتور و رسید انبار)

**Date:** 2026-11-11  
**Stage:** Design → Plan → Build (complete)  
**Status:** Implemented; plan at `docs/superpowers/plans/2026-11-11-invoice-receipts.md`  
**Visual SoT:** `docs/stitch-reference/screens/invoice-receipts/` (`screen.html` + `screenshot.png`)  
**Approach:** Dedicated Go `receipt` package + Mongo `InvoiceReceipt` draft→confirm (Approach 1)

## 1. Goal

Ship a production-shaped inbound receipt wizard at `/invoice-receipts` that matches the Stitch three-step flow, keeps Persian main headings, persists drafts in Mongo, and only creates live stock (batches + cardex + audit) on explicit confirm. Backend updates must reuse existing shelf/cardex/audit paths rather than duplicating batch logic.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Full 3-step wizard (header → lines → shelving/confirm) |
| Persistence | Mongo `InvoiceReceipt` with `draft` → `confirmed` |
| Architecture | New `internal/receipt` package; orchestrates shelf/cardex/audit |
| Excel reconciliation | Out of scope (`purchase-invoice-reconciliation` later) |
| Single-batch entry | Existing `POST /expiry-batches` remains for drug-details flows |
| Confirm audit | One `stock_receipt` on the receipt + cardex inbound per line (no per-batch `stock_in`) |
| Cancel API | Out of v1; status value `cancelled` reserved for later |
| Rollback on partial confirm | Best-effort delete batches created in the same request; leave receipt `draft` and return error |

## 3. Wizard & UX

### Steps (Stitch labels)

1. **مشخصات فاکتور و شرکت پخش** — invoice header  
2. **اسکن بارکد، سری ساخت و ورود اقلام** — scan desk + confirmed lines table + pricing summary  
3. **تطبیق نهایی، قفسه و کاردکس** — assign shelf/bin per line, review totals, confirm  

### Frontend

- Route: `/invoice-receipts` (optional `?receiptId=` to resume a draft)
- Shell: existing `AppShell` + sidebar item «ورود فاکتور و رسید انبار»
- Reuse `Stepper` (`src/components/domain/stepper.tsx`)
- Step 1: header form → `POST /receipts` or `PATCH /receipts/:id`
- Step 2: GTIN/UID field may call existing `GET /ttac/lookup`; add/edit/delete lines via line APIs; show gross/discount/VAT/net
- Step 3: require `locationLabel` and/or `binId` on every line; primary CTA runs `POST /receipts/:id/confirm`
- After confirm: success toast + links toward expiry/cardex; receipt becomes read-only
- Dashboard CTA «ثبت فاکتور خرید» navigates here instead of a toast
- Navigation to completed steps allowed while `status === draft`

### Persian headings

Main page title and step titles remain Persian (assessment requirement).

## 4. Data model

### `InvoiceReceipt`

```ts
{
  id: string
  status: 'draft' | 'confirmed' | 'cancelled'
  currentStep: 1 | 2 | 3
  header: {
    invoiceNo: string
    distributor: string
    issuedAt: string       // ISO YYYY-MM-DD
    receivedAt: string     // ISO YYYY-MM-DD
    warehouseLabel: string
    purchaseType: 'official_ttac' | 'official' | 'other'
    discountRial: number   // integer Rial
    vatRial: number        // integer Rial; often 0
    note?: string
  }
  lines: Array<{
    id: string
    drugId: string
    nameFa: string
    gtin?: string
    irc?: string
    batchNo: string
    expiry: string         // ISO YYYY-MM-DD
    quantity: number
    unitLabel: string
    buyPriceRial: number
    consumerPriceRial?: number
    locationLabel?: string
    binId?: string
    zone?: string
  }>
  createdBatchIds?: string[]
  createdBy: { userId: string; name: string; role: string }
  createdAt: string
  updatedAt: string
  confirmedAt?: string
}
```

### Server-computed totals (returned on GET/PATCH/confirm preview)

- `grossRial = sum(line.quantity * line.buyPriceRial)`
- `netRial = grossRial - header.discountRial + header.vatRial`

## 5. API (`/api/v1`, JWT required)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/receipts` | Create draft from header (step 1) |
| `GET` | `/receipts/:id` | Load receipt + totals |
| `GET` | `/receipts` | List (filter `status`, pagination); used to resume drafts |
| `PATCH` | `/receipts/:id` | Update header, `currentStep`, discount/VAT (draft only) |
| `POST` | `/receipts/:id/lines` | Add line (step 2) |
| `PATCH` | `/receipts/:id/lines/:lineId` | Edit line including shelf fields (steps 2–3) |
| `DELETE` | `/receipts/:id/lines/:lineId` | Remove line (draft only) |
| `POST` | `/receipts/:id/confirm` | Finalize stock intake |

### Confirm rules

1. Receipt must be `draft`; otherwise **409**
2. At least one line; every line needs `locationLabel` or `binId`; otherwise **400** with field map
3. For each line: create `StockBatch` using the same core rules as `expiry.Create` (drug resolve, unit defaults, zone from bin, `invoiceNo` from header, distributor from header)
4. Append cardex `inbound` per line
5. Append one audit event `action: stock_receipt`, `entityType: receipt`, `entityId: receipt.id`
6. Set `status=confirmed`, `confirmedAt`, `createdBatchIds`
7. If any mid-loop failure: delete batches already inserted in this request (best-effort), keep receipt `draft`, return error

### Shared batch creation

Extract the “insert batch + cardex inbound” core from `expiry.Service.Create` into a callable helper/method so receipt confirm and single-batch create stay consistent. The shared helper must **not** write audit events; callers own audit (`stock_in` for `expiry.Create`, `stock_receipt` for receipt confirm). Do **not** remove `POST /expiry-batches`.

## 6. Backend package layout

```
backend/internal/receipt/
  entity.go
  repository.go
  service.go
  handler.go
  dto.go
```

Wire in `bootstrap/app.go` + `routes.go`. Optional seed: one sample `draft` receipt for demos.

## 7. Frontend wiring

- `src/lib/api/receipts.ts` + `src/lib/receipts/data-access.ts` following existing API facade patterns
- Types in `src/lib/types/receipts.ts`
- View under `src/app/invoice-receipts/`
- Update `src/lib/nav/app-nav.ts`
- Update dashboard quick action that currently toasts about purchase invoice

## 8. Errors

- Validation: `errormap.Validation` with Persian field messages (same style as expiry)
- Not found: 404
- Confirm conflict: 409
- Auth: existing JWT middleware; 401 clears session and redirects to `/login` on the client

## 9. Testing

| Layer | Coverage |
|-------|----------|
| Go unit | Header/line validation, totals, confirm guards, happy-path confirm with fakes/repos |
| TS unit | Totals helpers, step gating (cannot confirm without shelves) |
| E2E | Create draft → add line → assign shelf → confirm → batch visible on expiry (or drug cardex) |

## 10. Out of scope

- `purchase-invoice-reconciliation` (Excel match)
- Full label printing beyond existing print helpers if already present
- Role-based permission matrix / `users-permissions`
- Editing or reversing a `confirmed` receipt (future: returns / adjustments)
- Live TTAC network beyond existing stub/cache lookup
- Mongo multi-document ACID transactions (use best-effort rollback instead)

## 11. Success criteria

- Operator can complete Stitch’s three steps end-to-end against Go + Mongo
- Draft survives refresh via `receiptId`
- Confirm creates batches queryable via existing expiry/shelf APIs and writes `stock_receipt` audit
- Persian main headings present; sidebar and dashboard entry points work
- Unit + e2e coverage for the happy path and key validation failures
