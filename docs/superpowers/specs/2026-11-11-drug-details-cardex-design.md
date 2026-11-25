# Design: `drug-details-cardex` (جزئیات دارو و کاردکس)

**Date:** 2026-11-11  
**Phase:** G — Screen 7  
**Status:** Approved in brainstorming; awaiting user review of this written spec  
**Visual SoT:** `docs/stitch-reference/screens/drug-details-cardex/` (`screen.html` + `screenshot.png`)  
**Approach:** Detail-hub on existing mocks (Approach 1)

## 1. Goal

Implement the drug profile + batch + cardex screen so the catalog → detail loop works end-to-end. Match Stitch visually using existing design-system components only. Support session-local writes (add batch, edit catalog fields, shelf move, quarantine) via SideDrawer / ConfirmDialog. No real API, secrets, or `.env`.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Screen | `drug-details-cardex` |
| Writes | Mock-local mutations with SideDrawer / ConfirmDialog (option B) |
| Routing | Flat `/drug-details-cardex?drugId=` (option B) |
| Cardex UI | DenseDataTable primary (Stitch) + `KardexTimeline` summary (option C) |
| URL state | Full: `drugId`, `tab`, batch filters, search, pagination (option A) |
| Architecture | Aggregate existing drug/batch/shelf mocks + new cardex mock module |

## 3. Architecture & navigation

### Route & query

- Path: `/drug-details-cardex`
- Query params:
  - `drugId` — required for data load
  - `tab` — `batches` \| `cardex` \| `info` (default `batches`)
  - `batchFilter` — `all` \| `in-stock` \| `expiring` \| `quarantine` (default `all`)
  - `q` — free-text search over batch number / pallet text
  - `page`, `pageSize` — client pagination for the active table (sizes aligned with prior screens, e.g. 10/25/50)

### Shell & entry

- Use `AppShell`, breadcrumb strip, and «بازگشت به لیست کاتالوگ دارو» → `/drug-catalog`.
- Wire `drug-catalog` placeholders that currently say drug-details is missing to `/drug-details-cardex?drugId=<id>`.
- Missing / unknown `drugId`: empty/error panel + link back to catalog (no invented demo drug when id is absent).

### Data access layer

Async mock functions (replaceable later by a backend):

- `getDrugDetail(drugId)`
- `getDrugBatches(drugId, filters)`
- `getCardexMovements(drugId)`
- Mutations (mutable in-module store for the SPA session: survive client navigations; lost on full page reload):
  - `addBatch(...)`
  - `updateDrugCatalog(...)`
  - `moveBatchShelf(...)`
  - `quarantineBatch(...)`

Comment on the DAL that catalog edits and batch mutations are **session-local mocks**, not persisted server state.

Reuse:

- Drugs from `src/lib/mock/drugs.ts`
- Shelf addresses / zones from shelves mocks
- Expiry / FEFO helpers from `src/lib/domain/expiry.ts`
- Actors consistent with audit/reorder mocks where useful

New:

- `src/lib/mock/cardex.ts` — typed movements, fixed seed relative to injectable `today`
- Query/URL helpers under `src/lib/drug-details/` (filter, FEFO rank, URL parse/serialize, form validation)

## 4. UI composition (Stitch-aligned, DS only)

### Above the fold

1. Breadcrumb + back + FEFO help control (opens read-only `Dialog` / info, not a form).
2. Drug hero: icon, badges (Rx / ATC / FEFO protocol), Persian `h1`, English name LTR, brand + manufacturer, metadata strip (IRC, GTIN, storage, legal class).
3. Quick actions: add batch, print shelf barcode, edit catalog.
4. Four `KpiMetricCard`s matching Stitch (dispensable stock, related capacity/ROP context as shown, active batches breakdown, nearest FEFO expiry). Persian digits + tabular numerals.

### Tabs (`Tabs`)

1. **Batches** — quick filter chips + search; `DenseDataTable` with Stitch columns (batch no., production date, Jalali expiry, buy/consumer price, margin, physical qty, shelf location, FEFO status, row actions). FEFO badges must include text labels, not color alone. Column priority / card degradation on tablet/mobile; no page horizontal scroll.
2. **Cardex** — heading + «پرینت کاردکس رسمی»; **`KardexTimeline`** summarizing recent movements from the same data source; below it a `DenseDataTable` of movements (timestamp, type, batch, in/out, balance, actor/shift, note).
3. **Clinical profile** — `Card` layout for pharmacology / logistics / supplier info (read from detail mock; edits only via hero «ویرایش کاتالوگ»).

### Hard rules

- Persian main heading (AGENTS.md).
- Persian digits, Jalali dates, logical CSS properties, light theme only.
- Technical ids / GTIN / English names: `dir="ltr"` inside RTL.
- Implement only controls present in Stitch (plus the agreed `KardexTimeline` summary on the cardex tab).
- No one-off components inside the page file; compose from AppShell, PageHeader (or equivalent breadcrumb pattern used elsewhere), KpiMetricCard, Tabs, DenseDataTable, TriageStatusBadge/Badge, SideDrawer, ConfirmDialog, Pagination, Dialog, Button, Input, Select, Card, KardexTimeline, Toast.
- If a required control is missing/insufficient in the DS → list under **Needed components** and stop for decision.

## 5. Behavior & mutations

### Domain rules

- FEFO order / «اولویت ۱ خروج» derived from nearest expiry among non-quarantined batches with stock; reuse expiry bucket helpers; injectable `today`.
- KPI counts and tab badges derive from the same filtered datasets (no divergent hand-counts).
- Cardex running balance: pure helper unit-tested; each append updates displayed balance consistently.

### Actions

| Action | UI | Effect |
|--------|-----|--------|
| ثبت ورود سری ساخت (بچ) جدید | SideDrawer form | New batch + inbound cardex movement |
| ویرایش کاتالوگ | SideDrawer form | Update in-memory drug profile fields |
| جابجایی قفسه / پالت | SideDrawer | Update batch location + cardex move |
| انتقال به قرنطینه | ConfirmDialog | Batch status → quarantine + cardex event |
| مشاهده فاکتور ورود | Read-only SideDrawer | Linked mock receipt summary or empty state |
| راهنما FEFO | Dialog | Static protocol copy |
| چاپ بارکد قفسه | Client print | Printable label HTML for current drug/shelf context |
| پرینت کاردکس رسمی | Client print | Printable cardex of current filtered movements |
| خروجی اکسل بچ‌ها | Client CSV | Current filtered batches; UTF-8 BOM; Persian headers; ISO + Jalali dates |

Validation: Persian error messages; focus first invalid field. Success: toast, close overlay, restore focus to the originating control.

Payloads must not contain realistic credentials, tokens, or real personal data.

### Extra states (not in Stitch)

Loading skeleton; no `drugId` / drug not found; empty batches; empty cardex; filter no-match; error + retry.

## 6. Testing & verification

### Unit (vitest)

- URL state parse/serialize (including invalid tab/filter fallbacks)
- Batch filter + search
- FEFO ranking / priority labeling
- Cardex balance after append
- Batch form validation

### E2E (Playwright)

- Desktop / tablet / mobile vs Stitch screenshot
- Catalog → detail with `drugId`
- Tab switch updates URL and content
- Keyboard: open drawer, Escape, focus return
- No page-level horizontal scroll

### Gate commands

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, focused Playwright spec.

## 7. Out of scope

- Real backend / auth / persistence across reloads beyond session memory
- Full invoice-receipts or dispensing screens (row «view receipt» is a stub drawer only)
- Dashboard, users-permissions, or other remaining Stitch screens
- New design-system primitives unless a Needed-components stop is raised

## 8. File sketch (implementation plan will detail)

- `src/app/drug-details-cardex/{page,*-view,nav}.tsx`
- `src/lib/mock/cardex.ts` (+ drug detail extensions as needed)
- `src/lib/drug-details/` helpers + tests
- `tests/e2e/drug-details-cardex.spec.ts`
- Catalog link updates; `PROGRESS.md` append when implementing
- Screenshots under `02-project/images/` at delivery of the screen

## 9. Success criteria

- Visual match to Stitch using DS components; Persian heading.
- Shareable URL restores drug, tab, filters, pagination.
- Session-local writes update batches, KPIs, and cardex (table + timeline) without inventing non-Stitch chrome.
- Verification commands above pass with real summaries recorded in PROGRESS.
- Stop after this screen; do not start the next one in the same delivery block.
