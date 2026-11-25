# Design: Live TTAC lookup (استعلام برخط تی‌تک)

**Date:** 2026-11-12  
**Stage:** Design → Plan → Build  
**Status:** Approved; implementation plan at `docs/superpowers/plans/2026-11-12-ttac-live-lookup.md`  
**Approach:** Shared Go `ttac.Client` + cache-backed lookup/search (minimal dual consumer)

## 1. Goal

Replace the Mongo-only TTAC stub with a live read-only integration to `newapi.ttac.ir` so operators can search and look up official drug licenses, then optionally apply that data in the drug catalog form and inbound receipt scan desk. PharmaStock remains the source of truth for inventory; TTAC is identity/license/price reference only.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Live lookup + search; no bulk catalog sync; no write-back to TTAC; no UID/serial track-and-trace |
| Architecture | New `backend/internal/ttac` HTTP client; orchestration stays in `drug.Service` |
| Consumers | Drug form drawer + receipt lines when `purchaseType === official_ttac` |
| Existing endpoint | Keep `GET /api/v1/ttac/lookup?q=` response shape (`status` / `product`) for compatibility |
| New endpoint | `GET /api/v1/ttac/search?term=&page=&pageSize=` for multi-hit selection |
| Active licenses | Default filter `status === 1` (فعال); inactive visible only when `includeInactive=true` or sole hit |
| Autofill | Suggestion only — operator confirms «استفاده از داده تی‌تک»; no silent overwrite |
| Cache | Mongo `ttac_cache` keyed primarily by `irc`, also `gtin`; service-level freshness 24h |
| Kill switch | `TTAC_ENABLED` (default true in prod/dev with network; tests/seed can set false → cache-only) |
| Frontend → TTAC | Forbidden; browser talks only to PharmaStock API |
| Secrets | Base URL + timeout in env; no real API keys committed (none required by current public GETs) |

## 3. External API (observed)

| Call | Method | Purpose |
|------|--------|---------|
| `/irfdamobile/v1/getnfisearch` | GET | Multi-result search: `Term`, `PageNumber`, `PageSize`, `IP` |
| `/irfdamobile/v1/getnfisearchbyirc` | GET | Detail by IRC: `drugLicense`, `drugIndex`, `drugFamily`, `ircPricing` |

Envelope: `{ data, succeeded, message, statusCode, errors }`.

Important license fields: `faBrandName`, `enBrandName`, `gtin`, `irc`, `status` / `statusStr`, `packageConsumerPrice`, `drugGenericCode`, `producerCompanyName`, `indexEnName`.

Detail extras: `drugIndex.atcCode`, `drugFamily` clinical texts, `ircPricing.packageCount` / `packageConsumerPrice`.

## 4. Architecture

```
UI (drug form / receipt scan)
  → GET /api/v1/ttac/lookup|search
  → drug.Service
      → ttac_cache (fresh hit?)
      → ttac.Client → newapi.ttac.ir
      → map → upsert cache → response
```

### Packages / files

| Piece | Location |
|-------|----------|
| HTTP client + DTOs + mapper | `backend/internal/ttac/` |
| Lookup/search orchestration | `backend/internal/drug/service.go` (+ handler/routes) |
| Cache repo | extend `backend/internal/drug/repository.go` (`ttac_cache`) |
| Config | `TTAC_BASE_URL`, `TTAC_TIMEOUT_MS`, `TTAC_ENABLED` in `pkg/config` + `.env.example` |
| Frontend API | `src/lib/api/drugs.ts` — extend lookup product fields; add `apiSearchTtac` |
| Drug form UX | search results picker → lookup by IRC → existing apply button |
| Receipt UX | scan field calls lookup; fills `gtin`/`irc`/name on line; does not invent `drugId` |

## 5. API contract

### `GET /api/v1/ttac/lookup?q=`

Auth: same JWT as today.

Query detection:

1. Digits only, length 16 → IRC → `getnfisearchbyirc`
2. Digits only, length 13–14 (Iran GTIN patterns incl. leading `0`/`626`) → GTIN → `getnfisearch` with Term=GTIN, exact `gtin` match; optional by-IRC enrich when one hit
3. Otherwise → treat as free text: if exactly one **active** search hit, return that product; else `not_found` (UI should use search)

Note: this design **supersedes** the “Live TTAC network out of scope” line in `2026-11-11-invoice-receipts-design.md` for read-only lookup/search only; bulk sync and write-back remain out of scope.

Response (compatible):

```json
{ "status": "found", "product": { /* TtacProduct + extensions */ } }
{ "status": "not_found" }
{ "status": "error", "message": "…" }
```

`TtacProduct` extensions (optional JSON fields, backward compatible):

- `irc` (string)
- `statusStr` (string)
- `packageConsumerPrice` (number, Rial package price from license/pricing)
- `fromCache` (bool) — true when served from stale/fresh cache after upstream failure or hit

### `GET /api/v1/ttac/search?term=&page=1&pageSize=10&includeInactive=`

Response:

```json
{
  "items": [
    {
      "irc": "...",
      "gtin": "...",
      "nameFa": "...",
      "brandName": "...",
      "manufacturer": "...",
      "status": 1,
      "statusStr": "فعال",
      "packageConsumerPrice": 6000000
    }
  ],
  "count": 3
}
```

Default: omit inactive (`status !== 1`). Empty term → validation error with Persian message.

## 6. Field mapping

| Local field | TTAC source |
|-------------|-------------|
| `nameFa` | `faBrandName` (trim) |
| `brandName` | `enBrandName` (trim) |
| `gtin` | `gtin` |
| `irc` | `irc` |
| `genericCode` | `string(drugGenericCode)` |
| `manufacturer` | `producerCompanyName` |
| `atcCode` | `drugIndex.atcCode` when by-IRC; else empty |
| `licenseExpiry` | leave empty when TTAC null |
| `dosageForm` / `strength` / `category` | leave empty unless a later deterministic parser is added; operator fills |
| `packageConsumerPrice` | `packageConsumerPrice` or `ircPricing.packageConsumerPrice` |

Do not invent `Drug.category` / dosage enum from free text in v1.

## 7. Cache model

Extend `ttac_cache` documents:

- `_id`: prefer `irc:<irc>` when known; else `gtin:<gtin>` for legacy seed rows
- `irc`, `gtin`, `genericCode`
- `product` (mapped payload)
- `fetchedAt` (UTC) for 24h freshness
- `rawStatus` (license status int)

Indexes: unique sparse on `irc`, unique sparse on `gtin` (already partially present).

Freshness rule: if `now - fetchedAt < 24h` → return cache without network. On upstream failure, return older cache if present (`fromCache: true`) else `error`.

## 8. Error & resilience

| Condition | API behavior |
|-----------|--------------|
| `TTAC_ENABLED=false` | Cache only; miss → `not_found` |
| Timeout / network / 5xx | Stale cache if any → `found` + `fromCache`; else `error` with fixed Persian message |
| `succeeded: false` or null data | `not_found` (or `error` if transport-level) |
| Multiple same-name licenses | Search lists them; lookup returns single IRC detail |
| Sole inactive hit on lookup | `found` with `statusStr` غیر فعال; UI must not auto-apply without confirmation |

Client: timeout default 5000ms; at most one retry on transient network error; no background workers.

## 9. Business rules (consumers)

### Drug catalog form

1. Operator enters term → call search (new) or legacy lookup for barcode/IRC.
2. Pick a hit → lookup by IRC → show preview → «استفاده از داده تی‌تک» patches form.
3. Saving still goes through existing `POST/PUT /drugs`; TTAC does not create catalog rows by itself.
4. Bulk «همگام‌سازی با فهرست رسمی TTAC» remains a hint / sample path — not a full sync job.

### Invoice receipts

1. When `purchaseType === official_ttac`, scan/lookup may populate line `gtin`, `irc`, and display name.
2. Matching to local `drugId` is separate: if a local drug with same GTIN exists, prefer linking it; otherwise operator selects/creates drug.
3. Other purchase types: TTAC lookup optional, not required to confirm.

## 10. Testing

| Layer | Coverage |
|-------|----------|
| Go unit | Query kind detection; mapper; active filter; cache fresh/stale/fallback |
| Go unit | `ttac.Client` via `httptest` — 200, empty, 5xx, timeout |
| TS unit | `apiLookupTtac` tolerates optional new product fields |
| E2E | With `TTAC_ENABLED=false` + seeded cache: form lookup happy path |

## 11. Out of scope

- Bulk / scheduled catalog sync
- Writing or updating licenses on TTAC
- UID / serial track-and-trace APIs beyond GTIN/IRC identity
- Auto-creating `Drug` documents from TTAC without operator save
- Parsing dosage form / strength / category from `faBrandName` (explicit follow-up if needed)
- Mongo multi-doc transactions for cache writes
- Committing real secrets or `.env` files

## 12. Success criteria

- Live search returns active licenses for a Persian brand term (e.g. آزارام) when TTAC reachable
- Lookup by IRC returns mapped product usable in drug form apply flow
- Cache serves within 24h and soft-fails to stale cache on outage
- Receipt scan can attach `gtin`/`irc` from lookup without breaking confirm rules
- Existing frontend `TtacLookupState` contract remains valid
- Persian main headings unchanged; no TTAC calls from the browser
