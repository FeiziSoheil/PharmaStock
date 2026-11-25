# Design: PharmaStock Go Backend (API + MongoDB)

**Date:** 2026-11-11  
**Status:** Approved; v1 implemented under `02-project/app/backend/`  
**Contract SoT:** `docs/backend/PAGES-FOR-BACKEND-PROMPTS.md`  
**Approach:** Single `cmd/api` binary · Echo · MongoDB · modular `internal/*` (Approach A)

## 1. Goal

Build a real Go HTTP API for PharmaStock that replaces the shapes currently served by frontend mocks (`src/lib/mock/*`). The API must implement auth, drug catalog (+ TTAC stub), shelf inventory, expiry/FEFO actions, reorder suggestions, and append-only audit — with Persian validation messages and domain rules (FEFO, ROP, login lock, WORM audit) matching the frontend contract document.

Out of scope for v1: Stitch-only pages (dashboard, transfer, stocktake, …), real TTAC network calls, server captcha, cardex endpoints (until Screen 7 frontend is complete), secrets or real passwords in the repo.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Location | `02-project/app/backend/` |
| Shape | One binary `cmd/api` + `internal` domains + `pkg` shared |
| HTTP library | **Echo** |
| Database | **MongoDB** (official `mongo-driver`) |
| Auth | JWT Bearer (`pkg/jwt`); lock state on `users` |
| Inventory source of truth | `stock_batches` collection |
| Reorder drafts | Persist in `purchase_drafts`; suggestions primarily derived |
| Audit | WORM: insert + query only; no update/delete in repository |
| API prefix | `/api/v1` |
| Frontend | Stays on mocks until wire-up phase; no Next.js route handlers for business API |
| Secrets | `.env.example` placeholders only; seed users use password **hashes** |

## 3. Repository layout

```
02-project/app/backend/
├── cmd/api/
│   ├── main.go
│   ├── bootstrap/
│   │   ├── app.go        # wire deps
│   │   ├── routes.go     # Echo route groups
│   │   └── server.go     # listen / graceful shutdown
│   ├── docs/             # optional OpenAPI later
│   └── Dockerfile
├── internal/
│   ├── auth/             # entity, dto, repository, service, handler, mapper
│   ├── drug/
│   ├── shelf/
│   ├── expiry/
│   ├── reorder/
│   └── audit/
├── pkg/
│   ├── config/
│   ├── database/         # Mongo client + ping + index ensure
│   ├── middleware/       # JWT, CORS, request-id, recover
│   ├── logger/
│   ├── validator/        # Persian field messages
│   ├── jwt/
│   ├── errormap/         # uniform HTTP error JSON
│   ├── requestctx/       # actor + branch from token
│   ├── pagination/       # page/pageSize/sort helpers
│   └── domain/           # pure FEFO / expiry buckets / ROP math
├── scripts/              # seed
├── docker-compose.yml    # api + mongo
├── Makefile
├── .env.example
└── go.mod
```

Each domain package follows: `entity.go`, `dto.go`, `repository.go`, `service.go`, `handler.go`, `mapper.go`.

## 4. MongoDB model

### Collections

| Collection | Purpose |
|------------|---------|
| `users` | Staff accounts; failed-login counter; temporary/permanent lock |
| `branches` | Warehouse/branch list for login |
| `drugs` | Drug catalog |
| `ttac_cache` | Stub/seed TTAC lookup results (no live external API in v1) |
| `bins` | Physical shelf positions (`address` unique, LTR) |
| `stock_batches` | **Source of truth** for on-hand stock (drug, bin, batchNo, expiry, qty, status) |
| `purchase_drafts` | Reorder draft orders (per submit) |
| `audit_events` | Append-only audit log |

`reorder_suggestions` is **not** a required persisted collection in v1: the reorder service derives active suggestions from `drugs` + usable `stock_batches` (+ on-order from drafts if needed). Drafting writes `purchase_drafts` and emits audit.

Optional later: denormalized `expiry_actions` history; v1 may store status on `stock_batches` alone (`active`, `quarantined`, `marked_return`, `quick_sale`, `relocated`).

### Logical relations

```
users + branches ──login──▶ JWT (actor, branchId)
drugs ◀── stock_batches.drugId
bins  ◀── stock_batches.binId
shelf list/KPIs, expiry list/FEFO, reorder engine  ◀── stock_batches (+ drugs/bins)
every successful mutation ──append──▶ audit_events
```

### Indexes (ensure on startup or migrate script)

- `users.username` — unique
- `branches._id` / stable string `id`
- `drugs.gtin` — unique sparse; indexes on `nameFa`, `genericCode`, `category`, `isControlled`
- `bins.address` — unique; `zone`
- `stock_batches`: `{ drugId, expiry }`, `{ binId }`, `{ status, expiry }`
- `audit_events`: `{ timestamp: -1 }`, `{ actor.id }`, `{ action }` — never support delete paths

### Domain constants (must match frontend)

- Expiry buckets: critical ≤30d, warning 31–90, watch 91–180, else ok; past today → expired
- Usable stock for ROP: exclude `expired` bucket quantities
- ROP: `needsReorder = available <= reorderPoint`; `suggestedQty` pack-rounded; urgency from `daysOfCover` thresholds `{2,5,14}`
- Shelf zones: A, B, C, R, S with labels from the contract doc
- Dosage forms / categories / distributors: same enumerations as `PAGES-FOR-BACKEND-PROMPTS.md`

### Seed

`make seed` loads demo branches, users (bcrypt/argon2 hashes only), drugs, bins, batches, and sample audit events. No plaintext passwords committed.

## 5. HTTP API surface

Base: `/api/v1`

### Auth

- `POST /auth/login`  
  Body: `{ username, password, branchId }`  
  Success: `{ ok: true, token, user, branch }`  
  Failure: `{ ok: false, code, message, canRetry?, retryAfterSeconds? }`  
  Codes: `invalid_credentials` | `account_locked` | `temporary_lock`  
  Behavior: 5 consecutive failures → temporary lock (~60s); permanent lock flag on user; audit `login_success` / `login_failure` / `login_lock`

Protected routes: `Authorization: Bearer <jwt>` via Echo middleware → `requestctx`.

### Drugs

- `GET /drugs` — search/filter/sort/page (Persian/Arabic ye/ke + digit normalization in service)
- `POST /drugs`, `PUT /drugs/:id`
- `GET /ttac/lookup?q=` → `found` | `not_found` | `error` union  
  Audit: `item_created` / `item_edited`

### Shelves

- `GET /shelves` — filters + embedded `kpis`
- `GET /shelves/:id` — bin detail with batches (FEFO highlight is client-side; API returns expiry-ordered batches)

### Expiry

- `GET /expiry-batches` — default sort nearest expiry; buckets computed server-side with injectable “today” for tests
- `PATCH /expiry-batches/:batchId/status` — `{ status }`  
  Audit: `expiry_action_confirmed` / `quarantine` / `return_to_distributor` as applicable

### Reorder

- `GET /reorder-suggestions` — derived list + `kpis`; default sort lowest `daysOfCover`
- `POST /reorder-suggestions/draft` — `{ items: [{ id, finalQty }], bufferPct? }`
- `POST /reorder-suggestions/dismiss` — `{ ids: string[] }`  
  Audit: `reorder_drafted`  
  Qty must be multiple of `packSize` (or server round-up policy documented in service); Persian validation messages

### Audit

- `GET /audit-events` — filters + `kpis` + `actors`
- `GET /audit-events/export` — `format=csv|json` (pdf optional/later)  
  **No** client write/update/delete endpoints

### List envelope

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 25,
  "pageCount": 0,
  "kpis": {}
}
```

Query commons: `page`, `pageSize` (10|25|50), `sortBy`, `sortDir` (`asc`|`desc`).

Dates in API: ISO `YYYY-MM-DD` or ISO datetime; money: integer Rials; numbers raw (not Persian digits).

## 6. Request flow & errors

```
Echo handler
  → bind + validate (pkg/validator, Persian messages)
  → service (pkg/domain rules)
  → repository (Mongo; multi-doc updates + audit append in one logical unit)
  → map DTO → JSON
```

| HTTP | When |
|------|------|
| 401 / 403 | Missing/invalid token or forbidden |
| 422 | Validation failure |
| 404 | Entity missing |
| 409 | Conflict (e.g. duplicate GTIN) |
| 429 | Temporary login lock |
| 5xx | Unexpected; clients may retry |

`pkg/errormap` owns a single JSON error shape for non-login failures; login keeps the `ok/code/message` contract above.

## 7. Testing & ops

- **Unit:** `pkg/domain` (expiry buckets, FEFO violations, ROP/suggested qty), validators
- **Integration:** repositories against Mongo (docker-compose profile or testcontainer)
- **Smoke:** `make up` → login → one authenticated list GET
- **Docker:** `Dockerfile` for api; `docker-compose.yml` runs `api` + `mongo`
- **Config:** env via `pkg/config` (`MONGO_URI`, `JWT_SECRET`, `HTTP_ADDR`, …) documented in `.env.example`

## 8. Build order

1. Skeleton: `go.mod`, Echo bootstrap, config, logger, Mongo ping, Makefile, compose  
2. `pkg/{jwt,errormap,validator,pagination,requestctx,domain}`  
3. `internal/auth` + audit **append** helper used by all modules  
4. `internal/drug` + TTAC stub  
5. `internal/shelf` on `bins` + `stock_batches`  
6. `internal/expiry` + `internal/reorder` on same batches  
7. `internal/audit` query/export  
8. (Later) cardex module when frontend Screen 7 is ready  
9. (Later) frontend mock → HTTP client wire-up

## 9. Compliance notes

- Main product headings remain Persian on the frontend; API messages for validation/errors that UI shows are Persian where the contract already defines them.
- Never commit real API keys, JWT secrets, or plaintext passwords.
- Do not implement audit clear/edit endpoints even if requested by UI convenience.

## 10. Open follow-ups (explicit, non-blocking)

- OpenAPI generation under `cmd/api/docs` — optional after first vertical slice  
- PDF export for audit — optional; CSV/JSON first  
- Captcha: remains client-side in v1  
- Collation strategy for Persian search — implement normalization in service (ye/ke, digits) before Mongo filter; full text index can be added if needed
