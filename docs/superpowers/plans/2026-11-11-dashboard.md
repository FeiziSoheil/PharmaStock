# Dashboard (`dashboard`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase G Screen — `/dashboard` — matching Stitch `dashboard`, aggregating live KPIs/FEFO/ROP/activity from existing mocks, and becoming the post-login landing.

**Architecture:** Next.js App Router client view under `AppShell`. Pure snapshot builder derives KPI/FEFO/ROP/activity from existing mocks (`drugs`, `expiryBatches`, `reorder`, `auditLog`, `shelves`) with injectable `today`. No new domain inventiveness beyond aggregation helpers. UI composes existing DS only; stop on Needed components.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind tokens, Vitest, Playwright, PharmaStock DS (`AppShell`, `PageHeader`, `KpiMetricCard`, `DenseDataTable`, `TriageStatusBadge`, `KardexTimeline`, `ConfirmDialog`, `AlertBanner`, `Button`/`Badge`/`Card`).

**Visual SoT:** `docs/stitch-reference/screens/dashboard/` (`screen.html` + `screenshot.png`)  
**Related:** `dashboard-inventory` is a separate later screen — out of scope.

## Global Constraints

- App code only under `02-project/app/`.
- Persian main H1; Persian digits; Jalali dates; tabular numerals; logical CSS; light theme only.
- No API calls, secrets, `.env`.
- No one-off page-local component files; DS-only composition in the view.
- Implement only Stitch sections/controls; no invented chrome.
- Missing/insufficient DS control → list under Needed components and STOP.
- Do not edit `README.md`, `BRIEF.md`, `templates/`, or `tools/export-agent-logs.py`.
- Do not start other screens; do not touch in-progress `drug-details-cardex` beyond shared nav if required.
- Commit only if the user explicitly asks (skip plan commit steps).
- Working directory for commands: `02-project/app`.

## Stitch sections (must match)

1. **Hero / operational banner** — live status, H1 «میز کار پایش و انبارداری دارویی», Jalali today + shift note, quick actions (نسخه‌پیچی / ثبت فاکتور خرید / انبارگردانی فوری / خروجی اکسل روزانه).
2. **5 KPI cards** — کل اقلام فعال، سری‌های ساخت، نزدیک به انقضا (<۹۰ روز)، منقضی‌شده، کسری/زیر ROP.
3. **FEFO matrix** — 4 tier cards: پایدار (>۱۸۰)، هشدار متوسط (۹۱–۱۸۰)، خروج فوری (۳۱–۹۰)، بحرانی (منقضی یا ≤۳۰) with sample batch rows + Stitch footers/CTAs.
4. **Split section** — Low-stock ROP table (8 cols desktop) + live activity feed (KardexTimeline) with link to audit log.

## Behavior (not in Stitch)

- All counts/samples derived from the same mocks + `getExpiryBucket` / reorder helpers; injectable `today` (default `MOCK_DASHBOARD_TODAY = 2026-11-11`).
- KPI click navigates: catalog / expiry (`bucket` filters) / reorder.
- Quick actions for unbuilt screens → Persian toast placeholders; «ثبت فاکتور» / «اکسل» toast; انبارگردانی toast (route not built).
- Critical FEFO «قرنطینه» / bulk disposal → `ConfirmDialog` then local toast (no persistence) OR deep-link to `/expiry-alerts-fefo`. Prefer ConfirmDialog matching prior expiry screen.
- ROP «سفارش به پخش» → navigate `/auto-reorder-suggestions` (or toast if row already drafted).
- Activity «مشاهده تاریخچه کامل» → `/audit-log`.
- Loading skeleton, empty (no data), error+retry.
- Responsive: KPI 1→2→3→5; FEFO 1→2→4; ROP table column priority (hide IRC/distributor below `lg`, ROP/deficit below `md`); no page H-scroll.
- Post-login redirect: `login` → `/dashboard`. Sidebar `dashboard` item → `/dashboard` (shell stays at `/shell` via tokens/domain links if needed — rename label to «داشبورد و آمار»).

## Needed components gate

Expected sufficient: `AppShell`, `PageHeader`/`Card`, `KpiMetricCard`, `DenseDataTable`, `TriageStatusBadge`, `KardexTimeline`, `ConfirmDialog`, `AlertBanner`, `Button`, `Badge`.  
If FEFO tier sample rows cannot be composed without a new DS primitive → STOP and list Needed components.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/dashboard/types.ts` | Snapshot types |
| `src/lib/dashboard/build-snapshot.ts` | Pure aggregation from mocks |
| `src/lib/mock/dashboard.ts` | `MOCK_DASHBOARD_TODAY`, async `getDashboardSnapshot`, failure injection |
| `src/app/dashboard/{page,dashboard-view,nav}.tsx` | Route + UI |
| `src/lib/nav/app-nav.ts` | Point dashboard → `/dashboard` |
| `src/app/login/login-view.tsx` | Redirect to `/dashboard` |
| `src/app/page.tsx` | Home link |
| `tests/unit/dashboard/build-snapshot.test.ts` | Unit tests |
| `tests/e2e/dashboard.spec.ts` | Playwright |
| `docs/design-system/PROGRESS.md` | Append section |
| `02-project/images/h14-dashboard-{desktop,tablet,mobile}.png` | Screenshots |

---

### Task 1: Snapshot types + pure builder (TDD)

**Files:**
- Create: `src/lib/dashboard/types.ts`
- Create: `src/lib/dashboard/build-snapshot.ts`
- Test: `tests/unit/dashboard/build-snapshot.test.ts`

**Interfaces:**
- Produces:
  - `DashboardKpis`, `FefoTierId = 'ok' | 'watch' | 'warning' | 'critical_expired'`
  - `FefoTierCard`, `FefoSampleBatch`, `DashboardLowStockRow`, `DashboardActivityItem`
  - `DashboardSnapshot`
  - `buildDashboardSnapshot(input: { today: Date; drugs; batches; reorderRows; shelves; auditEvents; shiftLabel }): DashboardSnapshot`

**FEFO tier mapping (single source via `getExpiryBucket`):**
- `ok` → bucket `ok` (>180)
- `watch` → bucket `watch` (91–180)
- `warning` → bucket `warning` (31–90)
- `critical_expired` → buckets `critical` ∪ `expired` (≤30 or past)

**KPI near-expiry (<90 days):** count batches where bucket ∈ {`critical`,`warning`} (exclude already `expired` from this KPI; expired has its own card).

**KPI batches:** count active (non-quarantined) batches from expiry mock (or shelf batches if richer) — prefer `expiryBatches` store length of `status === 'active'` + all statuses that still sit in warehouse except write-off equivalents; document: count all mock expiry batches with status not in `marked_return` OR simply all batches in mock — use **all current expiry mock rows** as «بَچ فعال» for consistency with Screen 4 data.

**KPI drugs:** `drugs.filter(d => d.totalStock > 0).length` or all catalog length — Stitch says «فعال»; use drugs with `totalStock > 0`.

**Low stock:** top 5 reorder rows by urgency / lowest days-of-cover where `needsReorder`.

**Activity:** map latest 4 audit events → `KardexTimelineItem` shape (title, description, timestamp Jalali-relative label via helper with injectable now, tone from severity).

- [ ] **Step 1: Write failing tests** for KPI consistency with buckets, FEFO sample sorted by expiry asc within tier, low-stock only below ROP, activity limit 4, invalid dates skipped.

- [ ] **Step 2: Implement builder** — no `Date.now()` inside pure functions; pass `today`.

- [ ] **Step 3: Run** `pnpm exec vitest run tests/unit/dashboard/build-snapshot.test.ts` → PASS.

---

### Task 2: Mock DAL

**Files:**
- Create: `src/lib/mock/dashboard.ts`

**Interfaces:**
- `MOCK_DASHBOARD_TODAY = '2026-11-11'`
- `getDashboardSnapshot(options?: { fail?: boolean; delayMs?: number }): Promise<DashboardSnapshot>`
- Reuses `MOCK_DRUGS`, expiry store, reorder suggestions builder, `MOCK_SHELVES`, audit events; fixed seed; optional fail for error UI.

- [ ] **Step 1: Implement DAL** with short delay (~200ms).
- [ ] **Step 2: Smoke-import from a tiny unit test or extend Task 1 test importing DAL once.**

---

### Task 3: Dashboard UI

**Files:**
- Create: `src/app/dashboard/page.tsx`, `nav.ts`, `dashboard-view.tsx`

**Compose:**
- `AppShell` + `getAppNavItems('dashboard')`
- Hero Card section (Stitch banner + quick actions)
- Optional `AlertBanner` if expired+critical > 0 (dismiss session) — only if it mirrors Stitch urgency; Stitch has no top AlertBanner, so **omit** unless needed for a11y summary — **omit to avoid inventing**.
- 5× `KpiMetricCard` (clickable → `router.push`)
- FEFO section: 4 Cards composed with Badge + sample rows + footer buttons
- Split: `DenseDataTable` for ROP + `KardexTimeline` for activity + link Button to audit
- States: skeleton / error+retry / empty snapshot edge

**ConfirmDialog:** bulk quarantine CTA on critical tier.

- [ ] **Step 1: Implement view matching Stitch structure**
- [ ] **Step 2: Manual visual check vs screenshot (Playwright later)**

---

### Task 4: Wiring

**Files:**
- Modify: `src/lib/nav/app-nav.ts` — dashboard href `/dashboard`, label «داشبورد و آمار»; keep `/shell` reachable from home or as «پوسته» under domain-only — add separate item only if needed; prefer changing dashboard item and leave shell on home page links.
- Modify: `src/app/login/login-view.tsx` — `router.push('/dashboard')`
- Modify: `src/app/page.tsx` — link to `/dashboard`
- Append: `docs/design-system/PROGRESS.md`

---

### Task 5: Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm exec vitest run tests/unit/dashboard`
- [ ] `pnpm build`
- [ ] `PLAYWRIGHT_PORT=<free> pnpm exec playwright test tests/e2e/dashboard.spec.ts`
  - desktop/tablet/mobile screenshots vs Stitch
  - no page H-scroll
  - keyboard: KPI focus, FEFO quarantine dialog Escape/focus return, activity link
- [ ] Save screenshots under `02-project/images/h14-dashboard-*.png`
- [ ] Append PROGRESS; STOP.

## Self-review

- Spec coverage: all 4 Stitch sections + behavior + responsive + verification tasks present.
- No placeholders / TBD.
- Types consistent: `DashboardSnapshot` feeds view + DAL.
- `dashboard-inventory` explicitly out of scope.
