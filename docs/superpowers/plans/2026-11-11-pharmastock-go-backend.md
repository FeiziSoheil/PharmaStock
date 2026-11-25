# PharmaStock Go Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable Echo + MongoDB API under `02-project/app/backend/` matching `docs/superpowers/specs/2026-11-11-pharmastock-go-backend-design.md` and `docs/backend/PAGES-FOR-BACKEND-PROMPTS.md`.

**Architecture:** Single `cmd/api` binary; domain packages in `internal/{auth,drug,shelf,expiry,reorder,audit}`; shared `pkg/*`; `stock_batches` is inventory source of truth; audit is WORM append-only.

**Tech Stack:** Go 1.22+, Echo v4, mongo-driver, golang-jwt, bcrypt, docker-compose (api + mongo).

## Global Constraints

- Path: `02-project/app/backend/` only for Go code
- API prefix: `/api/v1`
- No real secrets in repo; `.env.example` placeholders only; seed hashes passwords at runtime
- No audit update/delete endpoints
- Persian validation / login messages where UI expects them
- Do not commit unless the user explicitly asks

---

### Task 1: Skeleton + shared pkg + domain math

**Files:**
- Create: `backend/go.mod`, `Makefile`, `docker-compose.yml`, `.env.example`, `cmd/api/Dockerfile`
- Create: `backend/pkg/{config,database,logger,jwt,errormap,validator,pagination,requestctx,middleware,domain}/*.go`
- Test: `backend/pkg/domain/expiry_test.go`, `backend/pkg/domain/reorder_test.go`

**Produces:** `config.Load`, `database.Connect`, `domain.GetExpiryBucket`, `domain.SuggestedQuantity`, Echo-ready middleware helpers

- [ ] Scaffold module `github.com/pharmastock/backend` (or path matching folder)
- [ ] Port expiry + reorder pure functions from frontend `src/lib/domain/*`
- [ ] Unit tests for buckets / ROP / pack rounding
- [ ] Wire empty Echo server + Mongo ping in bootstrap

### Task 2: Audit append + Auth login

**Files:** `internal/audit/*` (writer + later query), `internal/auth/*`, bootstrap routes

**Produces:** `POST /api/v1/auth/login`, JWT middleware, `audit.Appender.Append`

- [ ] User/branch repos; bcrypt verify; 5-fail temp lock (~60s); permanent lock flag
- [ ] Login success/failure JSON contract from design
- [ ] Emit `login_success` / `login_failure` / `login_lock`

### Task 3: Drugs + TTAC stub

**Files:** `internal/drug/*`

**Produces:** `GET/POST /drugs`, `PUT /drugs/:id`, `GET /ttac/lookup`

- [ ] List filters + pagination envelope
- [ ] Persian search normalization (ye/ke, digits)
- [ ] Audit `item_created` / `item_edited`

### Task 4: Shelf + Expiry + Reorder

**Files:** `internal/shelf/*`, `internal/expiry/*`, `internal/reorder/*`

**Produces:** shelf list/detail+kpis; expiry list + PATCH status; reorder GET/draft/dismiss

- [ ] All reads derive from `bins` + `stock_batches` (+ `drugs`)
- [ ] Expiry status updates batch + audit
- [ ] Reorder derives suggestions; draft → `purchase_drafts`

### Task 5: Audit query/export + seed + verify

**Files:** `internal/audit` query/export, `scripts/seed/main.go`, README in backend

- [ ] `GET /audit-events`, `GET /audit-events/export?format=csv|json`
- [ ] `make seed` / `make up` / `make test`
- [ ] Smoke: login + GET `/drugs`

---

**Execution note:** User requested immediate implementation; execute inline in this session without waiting for approach choice. Skip git commits unless user asks.
