# Specifications of Developed Pages — Guide for Writing Backend Prompts

> **Audience:** Agent / backend developer  
> **Purpose:** Using this document, write a prompt for each business page covering the API, data model, endpoints, validation, and domain rules.  
> **Frontend status:** All data is currently client-side mock (`src/lib/mock/*`). The contracts below are direct replacements for those mocks.  
> **Extracted on:** 1404/08/20 (Jalali) · 2026-11-11  
> **Project:** Pharmacy inventory · PharmaStock (RTL, Persian, light-only)

---

## 0. Brief for the backend prompt author

Write a separate prompt for **each business page** that includes the following:

1. **Page purpose** and the target user role  
2. **Resources** and exact model fields  
3. **Endpoints** (CRUD / list / action) with query/body/response matching the types below  
4. **Domain rules** (FEFO, ROP, login lockout, WORM audit, etc.)  
5. **Validation** — Persian messages expected by the UI  
6. **Error states** the UI covers: loading / empty / no-match / error+retry / confirm  
7. **Related audit events** (`AUDIT_ACTIONS` codes)  
8. **No UI dependency:** data contract only; styles/components are not required

**Out of scope for the backend in this document:** design galleries (`/tokens`, `/components`, `/shell`, `/domain`) and the home bootstrap page (`/`).

---

## 1. Page status summary

### 1.1 Implemented business pages (backend priority)

| # | Path | Persian title | Status | Mock layer |
|---|------|---------------|--------|------------|
| 1 | `/login` | Login to the pharmacy inventory (ورود به انبار دارو) | ✅ Complete | `src/lib/mock/auth.ts` |
| 2 | `/drug-catalog` | Drug catalog and item registration (کاتالوگ دارو و ثبت اقلام) | ✅ Complete | `src/lib/mock/drugs.ts` |
| 3 | `/shelf-inventory` | Physical inventory by shelf (موجودی فیزیکی بر اساس قفسه) | ✅ Complete | `src/lib/mock/shelves.ts` |
| 4 | `/expiry-alerts-fefo` | Expiry alerts and FEFO (هشدارهای انقضا و FEFO) | ✅ Complete | `src/lib/mock/expiryBatches.ts` |
| 5 | `/auto-reorder-suggestions` | Auto-reorder suggestions (پیشنهاد سفارش خودکار) | ✅ Complete | `src/lib/mock/reorder.ts` |
| 6 | `/audit-log` | Event report and audit log (گزارش و لاگ وقایع - ممیزی) | ✅ Complete (read-only) | `src/lib/mock/auditLog.ts` |

### 1.2 In design / partially ready (full route not yet in place)

| Suggested path | Title | Status |
|----------------|-------|--------|
| `/drug-details-cardex?drugId=` | Drug details, batches, and cardex (جزئیات دارو، بچ‌ها و کاردکس) | Approved spec + URL types; UI not yet complete. Catalog links are currently `#` |

### 1.3 Stitch pages that do not yet have a business frontend (for later / optional backend work)

`dashboard`, `dashboard-inventory`, `internal-transfer`, `dispensing-dispatch`, `invoice-receipts`, `purchase-invoice-reconciliation`, `distributor-returns`, `periodic-stocktake`, `users-permissions`, `controlled-substances-ledger`

Visual reference: `docs/stitch-reference/INDEX.md`

---

## 2. System-wide shared contracts

### 2.1 Direction and display

- UI is fully RTL (`lang=fa`, `dir=rtl`)
- Dates in the UI are Jalali; in the data model prefer **ISO `YYYY-MM-DD`** or ISO datetime
- Technical identifiers / GTIN / IRC / IP / English → `dir="ltr"` in the UI
- Persian numerals in display; send raw numbers in the API
- Currency: rial, integer (no mandatory decimal places)

### 2.2 Shared pagination and sorting

Almost all lists:

```ts
page?: number        // default 1
pageSize?: number    // typically 10 | 25 | 50
sortBy?: string
sortDir?: 'asc' | 'desc'
```

Typical list response:

```ts
{
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}
```

### 2.3 Dosage forms and categories (catalog)

```ts
DOSAGE_FORMS = [
  'قرص',         // tablet
  'کپسول',       // capsule
  'شربت',        // syrup
  'آمپول',       // ampoule
  'ویال',        // vial
  'قلم تزریقی',  // injection pen
  'پماد',        // ointment
  'قطره',        // drops
  'سرم',         // IV fluid
]

DRUG_CATEGORIES = [
  'آنتی‌بیوتیک و ضدباکتری', // Antibiotics and antibacterials
  'قلب و عروق',              // Cardiovascular
  'دستگاه گوارش',            // Gastrointestinal
  'اعصاب و روان',            // Neuropsychiatry
  'دیابت و غدد',             // Diabetes and endocrine
  'مسکن و ضدالتهاب',         // Analgesics and anti-inflammatories
  'تنفس و آلرژی',            // Respiratory and allergy
  'ویتامین و مکمل',          // Vitamins and supplements
  'تحت کنترل / مخدر',        // Controlled / narcotic
]
```

### 2.4 Storage temperature

`'room' | 'fridge' | 'freezer' | 'light'`

UI labels:

- room → Room temperature (15 to 25°C) (دمای اتاق)
- fridge → Refrigerated (2 to 8°C) (یخچالی)
- light → Strict light protection (محافظت دقیق از نور)
- freezer → Freezer (below zero) (فریزر)

### 2.5 Shelf zones

```ts
SHELF_ZONES = [
  { id: 'A', label: 'سالن اصلی A (داروهای روتین)' }, // Main hall A (routine drugs)
  { id: 'B', label: 'سالن B (سرم و حجیم)' },          // Hall B (IV fluids and bulky items)
  { id: 'C', label: 'پیشخوان تحویل نسخه' },           // Prescription dispensing counter
  { id: 'R', label: 'اتاق سرد / زنجیره سرد' },        // Cold room / cold chain
  { id: 'S', label: 'اتاق حفاظت‌شده (گاوصندوق)' },    // Secured room (safe)
]
```

Physical address is LTR: `ZONE-RACK-SHELF-BIN` e.g. `A-03-2-04`

### 2.6 Distributors (reorder)

```ts
REORDER_DISTRIBUTORS = [
  { id: 'daroupakhsh', nameFa: 'داروپخش' },       // Daroupakhsh
  { id: 'hejrat', nameFa: 'پخش هجرت' },           // Hejrat Distribution
  { id: 'razi', nameFa: 'پخش رازی' },             // Razi Distribution
  { id: 'alborz', nameFa: 'پخش البرز' },          // Alborz Distribution
  { id: 'ferdows', nameFa: 'پخش فردوس' },        // Ferdows Distribution
  { id: 'abidi', nameFa: 'داروسازی عبیدی' },      // Abidi Pharmaceutical
]
```

### 2.7 Audit codes (must be recorded in the backend)

| code | labelFa | category |
|------|---------|----------|
| `login_success` | Successful login (ورود موفق) | auth |
| `login_failure` | Failed login (ورود ناموفق) | auth |
| `login_lock` | Temporary account lock (قفل موقت حساب) | auth |
| `item_created` | New drug registered (ثبت داروی جدید) | catalog |
| `item_edited` | Drug details edited (ویرایش مشخصات دارو) | catalog |
| `shelf_move` | Shelf relocation (جابجایی قفسه‌ای) | inventory |
| `expiry_action_confirmed` | Expiry action confirmed (تایید اقدام انقضا) | inventory |
| `reorder_drafted` | Shortage order drafted (پیش‌نویس سفارش کسری) | inventory |
| `stock_receipt` | Invoice receipt confirmed (تایید فاکتور ورودی) | inbound |
| `transfer` | Internal transfer (انتقال بین‌انباری) | inventory |
| `dispensing` | Dispensing and dispatch (نسخه‌پیچی و ترخیص) | outbound |
| `controlled_dispense` | Controlled-drug dispensing (نسخه‌پیچی داروی مخدر) | controlled |
| `return_to_distributor` | Return to distributor (مرجوعی به پخش) | outbound |
| `stocktake_adjust` | Stocktake adjustment (تعدیل انبارگردانی) | inventory |
| `role_change` | Access role change (تغییر نقش دسترسی) | access |
| `controlled_substance_entry` | Controlled-substance receipt entry (ثبت ورود داروی تحت کنترل) | controlled |
| `price_mod` | Official price edited (ویرایش نرخ مصوب) | pricing |
| `quarantine` | Quarantine / sales hold (قرنطینه / توقف فروش) | inventory |

---

## 3. Page: Login — `/login`

### 3.1 Purpose

Authenticate warehouse staff without AppShell (standalone page). On success → redirect to home/dashboard.

### 3.2 UI inputs

| Field | Required | Notes |
|-------|----------|-------|
| `branchId` | Yes | Branch/warehouse |
| `username` | Yes | Staff ID (LTR) |
| `password` | Yes | (LTR) |
| captcha | Yes (client-side) | Local challenge; the backend may define a separate real captcha |
| remember session | Optional | Checkbox |

Sample UI branches:

- Central pharmacy — warehouse no. 1 (master cardex) (داروخانه مرکزی - انبار شماره ۱ (کاردکس کل))
- Cold-chain warehouse (vaccines and biologics) (انبار زنجیره سرد (واکسن و بیولوژیک))
- Valiasr branch dispensing and clinical unit (واحد توزیع و بالینی شعبه ولیعصر)
- Emergency crash cart and critical items (ترالی اورژانس و اقلام حیاتی)

### 3.3 Current mock contract (to be replaced by the API)

```ts
POST /auth/login
body: { username: string, password: string, branchId: string }

// success
{ ok: true /* + token/session in the real backend */ }

// failure
{
  ok: false
  code: 'account_locked' | 'network_error' | 'temporary_lock' | /* suggestion: invalid_credentials */
  message: string  // Persian
  canRetry?: boolean
  retryAfterSeconds?: number
}
```

### 3.4 Behavioral rules expected by the UI

- 5 consecutive failures (in the mock, with username=`error`) → temporary lock (~60 seconds) + Persian countdown
- username=`locked` → permanent account lock
- Persian validation messages on blur/submit; focus the first invalid field
- Caps Lock warning
- **Never** put a real password/token in logs or the repo

### 3.5 Audit

- `login_success` / `login_failure` / `login_lock`

### 3.6 Frontend reference files

- `src/app/login/login-view.tsx`
- `src/lib/mock/auth.ts`
- `src/lib/auth/login-validation.ts`

---

## 4. Page: Drug catalog — `/drug-catalog`

### 4.1 Purpose

List, search, filter, register/edit drugs + TTAC/IRC lookup for autofill.

### 4.2 `Drug` model

```ts
type Drug = {
  id: string
  nameFa: string
  brandName: string
  dosageForm: DosageForm
  strength: string
  gtin: string
  genericCode: string
  manufacturer: string
  category: DrugCategory
  isControlled: boolean
  totalStock: number
  reorderLevel: number
  nearestExpiry: string          // ISO YYYY-MM-DD
  atcCode?: string
  storageTemp?: 'room' | 'fridge' | 'freezer' | 'light'
}
```

### 4.3 List

```ts
GET /drugs
query: {
  search?: string
  dosageForm?: DosageForm | ''
  category?: DrugCategory | ''
  isControlled?: boolean | null
  stockStatus?: 'ok' | 'low' | 'out' | 'expiring' | ''   // Align the exact filter name with the frontend StockStatusFilter
  sortBy?: 'nameFa' | /* other fields */
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

response: {
  items: Drug[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}
```

**Search:** Must cover Persian/Arabic normalization (ی/ي, ک/ك) and Persian/Latin digits (the frontend already does this client-side).

**Default UI sort:** `nameFa` ascending.

### 4.4 TTAC lookup

```ts
GET /ttac/lookup?q={gtinOrIrc}

response union:
  | { status: 'found', product: TtacProduct }
  | { status: 'not_found' }
  | { status: 'error', message: string }

type TtacProduct = {
  nameFa: string
  brandName: string
  dosageForm: DosageForm
  strength: string
  gtin: string
  genericCode: string
  manufacturer: string
  atcCode: string
  licenseExpiry: string
  category: DrugCategory
}
```

### 4.5 Create / edit

```ts
POST /drugs
PUT  /drugs/{id}
body: drawer form fields (name, brand, form, strength, GTIN, generic code, manufacturer, category, ATC, storage temperature, isControlled, …)
```

Persian validation messages already exist in the UI; the backend must enforce the same required fields.

### 4.6 Link to details

Target: `/drug-details-cardex?drugId={id}` (not yet complete).

### 4.7 Audit

- `item_created` / `item_edited`

### 4.8 Reference files

- `src/app/drug-catalog/*`
- `src/lib/mock/drugs.ts`
- `src/lib/drugs/catalog-query.ts`

---

## 5. Page: Shelf inventory — `/shelf-inventory`

### 5.1 Purpose

Display physical inventory by location (list + shelf map `?view=grid`), zone/status filters, and bin details (read-only SideDrawer).

### 5.2 Models

```ts
type ShelfBatch = {
  drugId: string
  nameFa: string
  batchNo: string
  expiry: string     // ISO YYYY-MM-DD
  quantity: number
}

type ShelfBin = {
  id: string
  zone: 'A' | 'B' | 'C' | 'R' | 'S'
  zoneLabel: string
  rack: string
  shelf: string
  bin: string
  address: string              // LTR e.g. A-03-2-04
  isControlled: boolean
  capacity: number
  batches: ShelfBatch[]
  macroLocation: 'main' | 'dispensing' | 'cold' | 'controlled'
}

type ShelfBinStatus = 'empty' | 'occupied' | 'low' | 'expiring' | 'controlled'

type ShelfKpis = {
  capacityPct: number
  occupiedBins: number
  totalBins: number
  emptyBins: number
  dispensingReady: number
  replenishNeeded: number
  coldTempC: number
}
```

### 5.3 List

```ts
GET /shelves
query: {
  search?: string                 // drug name or address
  zone?: ShelfZoneId | ''
  stockStatus?: ShelfStockStatusFilter | ''
  controlledOnly?: boolean
  expiringSoon?: boolean
  macroLocation?: 'main' | 'dispensing' | 'cold' | ''
  sortBy?, sortDir?, page?, pageSize?
}

response: ShelfQueryResult & { kpis: ShelfKpis }
```

```ts
GET /shelves/{id}   // details of a single bin for the drawer
```

### 5.4 Domain notes

- Bin status is derived from stock/capacity/expiry/controlled-substance flags
- FEFO in the drawer: nearest expiry is highlighted
- Macro tabs: All / Main warehouse / Dispensing counter / Cold storage (همه / انبار مرکزی / پیشخوان / سردخانه)

### 5.5 Reference files

- `src/app/shelf-inventory/*`
- `src/lib/mock/shelves.ts`
- `src/lib/shelves/{address,shelf-query}.ts`
- `src/components/domain/warehouse-rack-grid.tsx`

---

## 6. Page: Expiry alerts and FEFO — `/expiry-alerts-fefo`

### 6.1 Purpose

Manage near-expiry batches, detect FEFO violations, and confirmed actions (quarantine / quick sale / return / relocation).

### 6.2 Domain thresholds (single source of truth)

```ts
EXPIRY_THRESHOLDS = {
  criticalMaxDays: 30,   // ≤30 → critical
  warningMaxDays: 90,    // 31..90 → warning
  watchMaxDays: 180,     // 91..180 → watch
}
// >180 → ok; past today → expired

type ExpiryBucket = 'expired' | 'critical' | 'warning' | 'watch' | 'ok'
```

The backend must compute these same buckets (the “today” date should be injectable for tests).

### 6.3 Model

```ts
type ExpiryBatchStatus =
  | 'active' | 'quarantined' | 'marked_return' | 'quick_sale' | 'relocated'

type ExpiryBatch = {
  batchId: string
  drugId: string
  nameFa: string
  nameEn: string
  manufacturer: string
  distributor: string
  invoiceNo: string
  batchNo: string
  expiry: string
  quantity: number
  unitLabel: string
  locationLabel: string
  storageNote: string
  zone: ShelfZoneId
  category: DrugCategory
  isControlled: boolean
  status: ExpiryBatchStatus
}
```

### 6.4 API

```ts
GET /expiry-batches
query: {
  search?, bucket?, category?, isControlled?, zone?,
  status?, stageTab?, hideQuarantined?,
  sortBy?, sortDir?, page?, pageSize?
}
// Default sort: nearest expiry (FEFO)
response: { items, total, page, pageSize, pageCount, kpis, /* allItems optional */ }

PATCH /expiry-batches/{batchId}/status
body: { status: ExpiryBatchStatus }
```

### 6.5 UI actions (ConfirmDialog)

| UI action | Target status | Note |
|-----------|---------------|------|
| Quarantine (قرنطینه) | `quarantined` | For expired controlled items, add extra confirmation text |
| Quick sale (فروش سریع) | `quick_sale` | |
| Return (مرجوعی) | `marked_return` | |
| Relocation (جابجایی) | `relocated` | |

### 6.6 Stage tabs (stageTab)

- All active alerts (همه هشدارهای فعال)
- Expired and quarantined (منقضی‌شده و قرنطینه)
- Less than 1 month (کمتر از ۱ ماه)
- 1 to 3 months (۱ تا ۳ ماه)
- Follow-up on company returns (پیگیری مرجوعی شرکت‌ها)

### 6.7 FEFO violation

If, in the list, a later-expiring batch appears before a sooner-expiring one → warning banner. Reference functions: `findFefoViolations` in `src/lib/domain/expiry.ts`.

### 6.8 Audit

- `expiry_action_confirmed` / `quarantine` / `return_to_distributor` (depending on the action)

### 6.9 Reference files

- `src/app/expiry-alerts-fefo/*`
- `src/lib/domain/expiry.ts`
- `src/lib/mock/expiryBatches.ts`
- `src/lib/expiry/expiry-query.ts`

---

## 7. Page: Auto-reorder suggestions — `/auto-reorder-suggestions`

### 7.1 Purpose

List of items that have reached the reorder point, suggested quantities, multi-select, and issuing an order draft.

### 7.2 Domain formulas (must be reproduced on the server)

```ts
needsReorder     = availableStock <= reorderPoint
suggestedQty     = ceil_to_pack( max(0, targetStock - availableStock - onOrderQuantity) )
daysOfCover      = availableStock / avgDailyUsage   // Infinity if usage ≤ 0

URGENCY_THRESHOLDS = { critical: 2, low: 5, reorder: 14 }  // based on daysOfCover
urgency: 'critical' | 'low' | 'reorder' | 'ok'
```

**Usable stock:** Expired batches (`expired`) must not be included in the stock total (`sumUsableQuantity` + `getExpiryBucket`).

### 7.3 `ReorderSuggestion` model

```ts
type ReorderSuggestion = {
  id: string
  drugId: string
  nameFa: string
  dosageForm: string
  strength: string
  irc: string
  distributorId: string
  distributorNameFa: string
  distributorNote: string
  category: string
  isControlled: boolean
  availableStock: number
  reorderPoint: number
  targetStock: number
  onOrderQuantity: number
  avgDailyUsage: number
  packSize: number
  unitCost: number
  unitLabel: string
  leadTimeDays: number
  suggestedQty: number
  daysOfCover: number
  urgency: ReorderUrgency
  locationHint: string
  status: ReorderRowStatus   // e.g. 'active' | 'order_drafted' | 'dismissed' (take the exact names from the mock)
  storageTemp?: 'room' | 'fridge' | 'freezer' | 'light'
}

type ReorderKpis = {
  belowRopCount: number
  zeroStockCount: number
  estimatedValue: number
  avgLeadTimeDays: number
  yesterdayDelta: number
  byDistributor: { id: string; nameFa: string; count: number }[]
}
```

### 7.4 API

```ts
GET /reorder-suggestions
query: {
  search?, distributorId?, category?, urgency?, isControlled?,
  activeOnly?: boolean,   // default true in the UI
  sortBy?: 'daysOfCover' | …, sortDir?: 'asc' | 'desc',
  page?, pageSize?
}
// Default sort: lowest daysOfCover
response: { items, total, …, kpis, allActive }

POST /reorder-suggestions/draft
body: {
  items: { id: string, finalQty: number }[]
  bufferPct?: 0 | 10 | 20
}
// Effect: status → order_drafted; return a per-distributor summary

POST /reorder-suggestions/dismiss
body: { ids: string[] }   // UI dismisses without a reason
```

### 7.5 Quantity validation

- Must be a multiple of `packSize` (or round-up)
- Persian error messages in `src/lib/reorder/quantity-validation.ts`

### 7.6 Order confirmation

- Line-item totals per distributor
- For controlled items, add extra confirmation text

### 7.7 Audit

- `reorder_drafted`

### 7.8 Reference files

- `src/app/auto-reorder-suggestions/*`
- `src/lib/domain/reorder.ts`
- `src/lib/mock/reorder.ts`
- `src/lib/reorder/*`
- `src/lib/persian/money.ts` (display formatting only; the API should return raw numbers)

---

## 8. Page: Audit log — `/audit-log`

### 8.1 Purpose

**Read-only / append-only (WORM)** log. No edit/delete/clear. CSV / PDF-print / JSON export of the current filter result.

### 8.2 Models

```ts
type AuditActor = {
  id: string
  name: string
  role: AuditRole
  initials: string
}

type AuditEvent = {
  id: string
  timestamp: string            // ISO datetime
  actor: AuditActor
  action: AuditActionCode
  entityType: AuditEntityType
  entityId: string
  entityLabel: string
  description: string
  severity: AuditSeverity
  source: AuditSource
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ip: string
  terminal: string
  securityStatus: AuditSecurityStatus
  isControlledSubstance: boolean
}
```

Catalog of codes/roles/severity/source: `src/lib/domain/auditEvents.ts`

### 8.3 API

```ts
GET /audit-events
query: {
  range?: DateRangePreset          // Jalali UI presets
  fromJalali?: string
  toJalali?: string
  actorId?: string
  role?: AuditRole | ''
  actions?: AuditActionCode[]      // multi
  actionGroup?: AuditActionFilterGroup | ''
  entityType?: AuditEntityType | ''
  severity?: AuditSeverity | ''
  search?: string
  sortBy?, sortDir?,               // default: newest-first
  page?, pageSize?
}
response: {
  items: AuditEvent[]
  total, page, pageSize, pageCount
  kpis: AuditKpis
  actors: AuditActor[]
}

// Export can be server-side; it is currently client-side on the filtered result
GET /audit-events/export?format=csv|json|pdf&…the same filters
```

### 8.4 Hard rules

- **No** endpoint for editing/deleting/clearing the log
- Retention is presented only as a read-only policy in the UI
- Controlled-substance events and login failures must be filterable/highlightable
- Before/after diff in event details

### 8.5 Reference files

- `src/app/audit-log/*`
- `src/lib/domain/auditEvents.ts`
- `src/lib/mock/auditLog.ts`
- `src/lib/audit/{audit-query,jalali-range,diff,export,url-state}.ts`

---

## 9. Future page: Drug details and cardex — `/drug-details-cardex`

> UI is not yet complete; spec is in `docs/superpowers/specs/2026-11-11-drug-details-cardex-design.md`

### 9.1 Query

```
drugId (required)
tab = batches | cardex | info
batchFilter = all | in-stock | expiring | quarantine
q, page, pageSize
```

### 9.2 DAL proposed by the spec

```ts
getDrugDetail(drugId)
getDrugBatches(drugId, filters)
getCardexMovements(drugId)

addBatch(...)
updateDrugCatalog(...)
moveBatchShelf(...)
quarantineBatch(...)
```

Suggested batch status: `'active' | 'quarantine' | 'blocked'`

### 9.3 Dependencies

Must be built on the same drugs / shelves / expiry resources, append cardex movements, and emit the related audit events (`shelf_move`, `quarantine`, `item_edited`, …).

---

## 10. Domain entities and cross-page dependencies

```
Auth ──login──▶ Session/Actor
                     │
Drug (catalog) ◀─────┼────▶ ShelfBin.batches.drugId
     │               │
     │               ├──▶ ExpiryBatch.drugId
     │               ├──▶ ReorderSuggestion.drugId
     │               └──▶ AuditEvent.entity*
     │
ExpiryBucket ◀── shared domain ──▶ usable stock for Reorder
FEFO order   ◀── shared domain ──▶ Expiry list + future dispensing
```

**Backend recommendation:** a warehouse bounded context with tables/services:

1. `users` / `sessions` / `branches`
2. `drugs` (+ TTAC cache/lookup)
3. `bins` / `locations` / `stock_batches`
4. `expiry_actions` (or status on the batch)
5. `reorder_suggestions` / `purchase_drafts`
6. `audit_events` (WORM)
7. (future) `cardex_movements`

---

## 11. Suggested prompt template for each page

Copy and fill in for each page:

```markdown
# Backend prompt: <PAGE_SLUG>

## Context
PharmaStock pharmacy inventory (RTL, Persian). Implement API only.
Front-end already consumes shapes described in
`docs/backend/PAGES-FOR-BACKEND-PROMPTS.md` section <N>.

## Resources & fields
(paste model)

## Endpoints
(method path, request, response, status codes)

## Domain rules
(list formulas / invariants)

## Validation (Persian messages)
(...)

## Audit events to emit
(...)

## Error cases UI expects
- 401/403
- 422 validation
- 404
- 409 conflict (optional)
- 429 / lock (login)
- 5xx → retryable

## Out of scope
UI, CSS, Next.js routes, secrets in repo
```

---

## 12. Map of key frontend files (for deeper digging)

| Topic | Path |
|-------|------|
| Page implementation progress | `docs/design-system/PROGRESS.md` |
| Stitch pages index | `docs/stitch-reference/INDEX.md` |
| Design tokens | `docs/design-tokens.md` |
| Drug details spec | `docs/superpowers/specs/2026-11-11-drug-details-cardex-design.md` |
| Mocks | `src/lib/mock/*.ts` |
| Domain pure | `src/lib/domain/*.ts` |
| View for each page | `src/app/<slug>/*-view.tsx` |

---

## 13. Suggested priority for writing backend prompts

1. Auth (`/login`) + Audit append pipeline  
2. Drugs + TTAC lookup (`/drug-catalog`)  
3. Locations / batches (`/shelf-inventory`)  
4. Expiry actions + FEFO (`/expiry-alerts-fefo`)  
5. Reorder engine (`/auto-reorder-suggestions`)  
6. Audit query/export (`/audit-log`)  
7. Drug details + cardex (when frontend Screen 7 is complete)

---

*This document was extracted from the current code and PROGRESS; if the mock contract intentionally differs from the real API, explicitly write “deviation” in the backend prompt.*
