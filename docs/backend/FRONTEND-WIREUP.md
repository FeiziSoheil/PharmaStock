# Connecting the Frontend to the Go Backend

## Current contract

The frontend is **always** connected to the Go API (`NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:8080`). The dual mock/`NEXT_PUBLIC_USE_API` path has been removed. Deterministic data remains only in `tests/fixtures/` for unit tests.

| Page | Data source |
|------|-------------|
| `/login` | `POST /api/v1/auth/login` (client-side captcha) |
| `/drug-catalog` | `GET/POST/PUT /drugs` + `GET /ttac/lookup` and `GET /ttac/search`; client-side CSV |
| `/shelf-inventory` | `GET /shelves` (+ `:id`); client-side label printing |
| `/expiry-alerts-fefo` | `GET /expiry-batches` + `PATCH .../status` |
| `/auto-reorder-suggestions` | `GET /reorder-suggestions` + draft/dismiss |
| `/audit-log` | `GET /audit-events`; server-side CSV/JSON; client-side PDF |
| `/dashboard` | Combination of lists (no dedicated endpoint) |
| `/drug-details-cardex` | `GET /drugs/:id`, batches from expiry, `POST /expiry-batches`, `PATCH .../location`, `PATCH .../status`, `GET /drugs/:id/cardex` |
| `/invoice-receipts` | `src/lib/api/receipts.ts` (facade: `src/lib/receipts/data-access.ts`) → `/api/v1/receipts` |
| `/dispensing-dispatch` | `src/lib/api/dispenses.ts` (facade: `src/lib/dispenses/data-access.ts`) → `/api/v1/dispenses` |
| `/internal-transfer` | `src/lib/api/transfers.ts` (facade: `src/lib/transfers/data-access.ts`) → `/api/v1/transfers` |
| `/users-permissions` | `src/lib/api/users.ts` (facade: `src/lib/users/data-access.ts`) → `/api/v1/users` and `/api/v1/rbac/matrix` |
| `/distributor-returns` | `src/lib/api/returns.ts` (facade: `src/lib/returns/data-access.ts`) → `/api/v1/returns` |

Facades: `src/lib/{drugs,shelves,expiry,reorder,audit,dashboard,drug-details,receipts,dispenses,transfers,returns}/data-access.ts`  
Clients: `src/lib/api/{auth,drugs,shelves,expiry,reorder,audit,cardex,receipts,dispenses,transfers,returns}.ts`

### Invoice receipts (`/api/v1/receipts`)

All require JWT (`auth: true`). The response body is an `InvoiceReceipt`; `grossRial` / `netRial` come from the server, and if they are missing the client fills them in with `computeReceiptTotals`.

| Method | Path | Client |
|--------|------|--------|
| `POST` | `/api/v1/receipts` | `createReceipt(header)` |
| `GET` | `/api/v1/receipts/:id` | `getReceipt(id)` |
| `GET` | `/api/v1/receipts?status=` | `listReceipts({ status })` |
| `PATCH` | `/api/v1/receipts/:id` | `patchReceipt(id, body)` |
| `POST` | `/api/v1/receipts/:id/lines` | `addReceiptLine(id, line)` |
| `PATCH` | `/api/v1/receipts/:id/lines/:lineId` | `patchReceiptLine(id, lineId, patch)` |
| `DELETE` | `/api/v1/receipts/:id/lines/:lineId` | `deleteReceiptLine(id, lineId)` |
| `POST` | `/api/v1/receipts/:id/confirm` | `confirmReceipt(id)` |

### Dispense orders (`/api/v1/dispenses`)

All require JWT (`auth: true`). The response body is a `DispenseOrder`; `goodsTotal` / `patientPayable` and the counters come from the server, and if they are missing the client fills them in with `computeDispenseTotals`. The line price in JSON is the `consumerPrice` field (same name on the client). An unknown status is normalized to `draft`.

| Method | Path | Client |
|--------|------|--------|
| `POST` | `/api/v1/dispenses` | `createDispense(body)` |
| `GET` | `/api/v1/dispenses/:id` | `getDispense(id)` |
| `GET` | `/api/v1/dispenses?status=` | `listDispenses({ status })` |
| `PATCH` | `/api/v1/dispenses/:id` | `patchDispense(id, body)` |
| `POST` | `/api/v1/dispenses/:id/lines` | `addDispenseLine(id, line)` |
| `PATCH` | `/api/v1/dispenses/:id/lines/:lineId` | `patchDispenseLine(id, lineId, patch)` |
| `DELETE` | `/api/v1/dispenses/:id/lines/:lineId` | `deleteDispenseLine(id, lineId)` |
| `POST` | `/api/v1/dispenses/:id/clear-lines` | `clearDispenseLines(id)` |
| `POST` | `/api/v1/dispenses/:id/confirm` | `confirmDispense(id)` |
| `GET` | `/api/v1/dispenses/fefo-preview?drugId=` | `fefoPreview(drugId)` |

`fefoPreview` returns one FEFO batch. If the response has no `consumerPrice`, the client puts the shelf's `consumerPriceRial` into `consumerPrice`.

### Internal transfers (`/api/v1/transfers`)

All require JWT (`auth: true`). The response body is an `InternalTransfer`; `createdAt` / `updatedAt` / `confirmedAt` come from the server in ISO (RFC3339) format.

| Method | Path | Client |
|--------|------|--------|
| `POST` | `/api/v1/transfers` | `createTransfer(header)` |
| `GET` | `/api/v1/transfers/:id` | `getTransfer(id)` |
| `GET` | `/api/v1/transfers?status=` | `listTransfers({ status })` |
| `PATCH` | `/api/v1/transfers/:id` | `patchTransfer(id, body)` |
| `POST` | `/api/v1/transfers/:id/lines` | `addTransferLine(id, line)` |
| `PATCH` | `/api/v1/transfers/:id/lines/:lineId` | `patchTransferLine(id, lineId, patch)` |
| `DELETE` | `/api/v1/transfers/:id/lines/:lineId` | `deleteTransferLine(id, lineId)` |
| `POST` | `/api/v1/transfers/:id/clear-lines` | `clearTransferLines(id)` |
| `POST` | `/api/v1/transfers/:id/confirm` | `confirmTransfer(id)` |

### Returns to distributors (`/api/v1/returns`)

All require JWT (`auth: true`).

| Method | Path | Client |
|--------|------|--------|
| `GET` | `/api/v1/returns/eligible?windowDays=&search=&distributorId=` | `getEligibleReturns(params)` |
| `POST` | `/api/v1/returns` | `createReturn(body)` |
| `GET` | `/api/v1/returns?status=&distributorId=` | `listReturns(params)` |
| `GET` | `/api/v1/returns/:id` | `getReturn(id)` |
| `POST` | `/api/v1/returns/:id/confirm` | `confirmReturn(id)` |
| `POST` | `/api/v1/returns/:id/settle` | `settleReturn(id, body)` |

### TTAC in the frontend

| Method | Path | Facade |
|--------|------|--------|
| `GET` | `/api/v1/ttac/lookup?q=` | `lookupTtac` in `src/lib/drugs/data-access.ts` |
| `GET` | `/api/v1/ttac/search?term=&page=&pageSize=&includeInactive=` | `searchTtac` in the same facade |

**Invoice receipt — line from scan/search:** At the scan desk on the `/invoice-receipts` page (once it is wired to the UI), first call `lookupTtac` or `searchTtac`; then `ttacProductToLinePatch` in `src/lib/receipts/ttac-line.ts` returns only `gtin`, `irc`, and `nameFa` to prefill the line form. **Do not generate `drugId` automatically** — the operator selects or registers the catalog drug.

## Intentionally client-side

- Login captcha, audit PDF, label/cardex printing
- Bulk sync with the real TTAC network (local cached lookup only)

## Running them together

```bash
# Terminal 1 — API
cd 02-project/app/backend
docker compose up -d mongo
SEED_ON_START=true DEMO_PASSWORD=change-me-demo-only make build
SEED_ON_START=true DEMO_PASSWORD=change-me-demo-only MONGO_URI=mongodb://127.0.0.1:27017 ./bin/api

# Terminal 2 — Next
cd 02-project/app/frontend
cp .env.example .env.local
pnpm dev
```

Demo login: `operator` / `change-me-demo-only`  
Sample drug details: `/drug-details-cardex?drugId=drug-amox`
