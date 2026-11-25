# PharmaStock API (Go · Echo · MongoDB)

Backend for انبار دارو · PharmaStock. Contract: `../docs/backend/PAGES-FOR-BACKEND-PROMPTS.md` and design spec `../docs/superpowers/specs/2026-11-11-pharmastock-go-backend-design.md`.

## Quick start

```bash
cp .env.example .env   # optional; compose has defaults
make up                # api :8080 + mongo :27017, seeds on start
curl -s http://localhost:8080/healthz
```

Login (demo user from seed):

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"operator","password":"change-me-demo-only","branchId":"branch-central"}'
```

Use `Authorization: Bearer <token>` for `/api/v1/drugs`, `/shelves`, `/expiry-batches`, `/reorder-suggestions`, `/audit-events`.

Local without Docker API (Mongo must be up):

```bash
make tidy && make test
SEED_ON_START=true DEMO_PASSWORD=change-me-demo-only make run
```

## Frontend wire-up

See `../docs/backend/FRONTEND-WIREUP.md`. The Next app always calls this API (`NEXT_PUBLIC_API_BASE_URL`).

## Notes

- Do not commit real secrets; only `.env.example` placeholders.
- Audit is append-only (no update/delete APIs).
- Demo password comes from `DEMO_PASSWORD` / compose env and is hashed at seed time.
