# User Profile & Header User Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the self-service `/profile` page, supporting backend `/api/v1/auth/me` and `/api/v1/auth/change-password` endpoints, and a unified interactive `UserMenu` in `TopHeader` across all PharmaStock pages.

**Architecture:** The Go/Echo backend adds three JWT-protected endpoints under `/api/v1/auth/` backed by an interface-based `auth.Store` and `auth.AuditLogger` for fast unit/handler tests. The Next.js frontend adds reactive `SessionUser` updates in `session.ts`, a `UserMenu` popover in `TopHeader` (replacing hardcoded avatars in six page views), and the RTL clinical `/profile` page inside `AppShell`.

**Tech Stack:** Go 1.24 + Echo v4 + MongoDB + bcrypt, Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Radix Popover + Vitest + Playwright.

**Spec:** [`02-project/app/docs/superpowers/specs/2026-11-12-user-profile-design.md`](../specs/2026-11-12-user-profile-design.md)

## Global Constraints

- App's main headings must be in Persian (`تیترهای اصلی برنامه فارسی باشند` — `<h1>` on `/profile`: `پروفایل و تنظیمات حساب کاربری`).
- All application code and tests live under `02-project/app/`.
- Self-service profile edits may only modify `name`, `email`, `phone`, and password (with current-password check); `role`, `branchId`, `unitLabel`, `personnelCode`, `medicalCouncilNo`, and `username` remain read-only.
- Never expose `passwordHash`, `failedAttempts`, or `lockUntil` in API JSON responses.
- RTL-first clinical styling using existing semantic tokens and shared/UI primitives (`AppShell`, `PageHeader`, `Card`, `Input`, `Button`, `Badge`, `Popover`, `AlertBanner`, `sonner`).

## Review Focus

- Empty or whitespace-only `name` on `PATCH /api/v1/auth/me` must return `422` validation error with field key `name` and never overwrite the stored name.
- Wrong `currentPassword` on `POST /api/v1/auth/change-password` must return `400`/`401`/`422` validation error with field key `currentPassword` and leave the stored password hash untouched.
- `newPassword` shorter than 8 characters or equal to `currentPassword` must be rejected with clear Persian field-level messages on both client and server.
- Hydration safety in `UserMenu`: initial server render and first client render must match before reading `sessionStorage`/`localStorage` (avoiding React hydration mismatch).
- Custom `actions` passed to `TopHeader` on pages like `dashboard` and `drug-catalog` must still render `<UserMenu />` at the end of `top-header-actions` without duplicate avatars.

---

### Task 1: Backend Self-Service `/auth/me` and `/auth/change-password`

**Files:**
- Modify: `02-project/app/backend/internal/auth/dto.go`
- Modify: `02-project/app/backend/internal/auth/repository.go`
- Modify: `02-project/app/backend/internal/auth/service.go`
- Modify: `02-project/app/backend/internal/auth/handler.go`
- Modify: `02-project/app/backend/cmd/api/bootstrap/routes.go`
- Create: `02-project/app/backend/internal/auth/service_test.go`
- Create: `02-project/app/backend/internal/auth/handler_test.go`

**Interfaces:**
- Produces:
  - `GET /api/v1/auth/me` -> `MeResponse`
  - `PATCH /api/v1/auth/me` (`UpdateMeRequest`) -> `MeResponse`
  - `POST /api/v1/auth/change-password` (`ChangePasswordRequest`) -> `ChangePasswordResponse`
  - `Store` and `AuditLogger` interfaces in `package auth` (with `*Repository` and `*audit.Service` satisfying them).

- [ ] **Step 1: Write failing unit & handler tests for `GetMe`, `UpdateMe`, and `ChangePassword`**

Create `02-project/app/backend/internal/auth/service_test.go` and `02-project/app/backend/internal/auth/handler_test.go` with an in-memory fake `Store` and fake `AuditLogger`:
- `TestGetMeSuccessAndNotFound`: verifies `MeResponse` includes `branchNameFa` and omits `passwordHash`/`failedAttempts`.
- `TestUpdateMeValidationAndPersistence`: verifies empty `name` -> validation error (`fields["name"]`), invalid `email` -> `fields["email"]`, short `phone` -> `fields["phone"]`, valid update -> trims fields, updates `NameNorm`, writes audit event `profile_update`.
- `TestChangePasswordValidationAndHashUpdate`: verifies wrong `currentPassword` -> validation error (`fields["currentPassword"]`), short `newPassword` (<8) -> `fields["newPassword"]`, same password -> `fields["newPassword"]`, valid change -> bcrypt hash updated and verifiable, audit event `password_change` recorded.
- `TestHandlerMeAndChangePassword`: HTTP test via Echo (`GET /api/v1/auth/me`, `PATCH /api/v1/auth/me`, `POST /api/v1/auth/change-password`) with `requestctx.Set` actor.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd 02-project/app/backend && go test ./internal/auth/...`
Expected: FAIL (undefined types/methods `MeResponse`, `GetMe`, `UpdateMe`, `ChangePassword`, etc.).

- [ ] **Step 3: Add DTOs and Repository methods**

- In `02-project/app/backend/internal/auth/dto.go`, add `MeResponse`, `UpdateMeRequest`, `ChangePasswordRequest`, `ChangePasswordResponse`.
- In `02-project/app/backend/internal/auth/repository.go`, add `FindUserByID(ctx, id)`, `UpdateProfile(ctx, id, name, nameNorm, email, phone string, updatedAt time.Time) error`, and `UpdatePassword(ctx, id, passwordHash string, updatedAt time.Time) error`.

- [ ] **Step 4: Refactor `auth.Service` to depend on `Store` & `AuditLogger` interfaces and implement `GetMe`, `UpdateMe`, `ChangePassword`**

In `02-project/app/backend/internal/auth/service.go`:
- Define `Store` interface (covering existing repo methods + the 3 new ones) and `AuditLogger` interface (`Append(ctx context.Context, in audit.AppendInput) (audit.Event, error)`).
- Implement `GetMe(ctx context.Context, actor requestctx.Actor) (MeResponse, error)`.
- Implement `UpdateMe(ctx context.Context, actor requestctx.Actor, req UpdateMeRequest, ip string) (MeResponse, error)` with email regex (`^[^\s@]+@[^\s@]+\.[^\s@]+$`) and phone length >= 8 validation matching `users/service.go`.
- Implement `ChangePassword(ctx context.Context, actor requestctx.Actor, req ChangePasswordRequest, ip string) (ChangePasswordResponse, error)` verifying `bcrypt.CompareHashAndPassword` and hashing with `bcrypt.DefaultCost`.

- [ ] **Step 5: Add Echo handlers and register routes**

- In `02-project/app/backend/internal/auth/handler.go`, add `Me(c)`, `UpdateMe(c)`, and `ChangePassword(c)`.
- In `02-project/app/backend/cmd/api/bootstrap/routes.go`, register under `secured`:
  - `secured.GET("/auth/me", r.Auth.Me)`
  - `secured.PATCH("/auth/me", r.Auth.UpdateMe)`
  - `secured.POST("/auth/change-password", r.Auth.ChangePassword)`

- [ ] **Step 6: Run backend tests and verify compilation**

Run: `cd 02-project/app/backend && go test ./internal/auth/... && go build ./...`
Expected: PASS and exit code 0.

- [ ] **Step 7: Commit**

```bash
git add 02-project/app/backend/internal/auth 02-project/app/backend/cmd/api/bootstrap/routes.go
git commit -m "feat(backend): add self-service auth/me and change-password endpoints"
```

---

### Task 2: Frontend Session Reactivity, Profile API Client & Validation

**Files:**
- Modify: `02-project/app/src/lib/api/session.ts`
- Modify: `02-project/app/src/lib/domain/auditEvents.ts`
- Create: `02-project/app/src/lib/api/profile.ts`
- Create: `02-project/app/src/lib/profile/validation.ts`
- Create: `02-project/app/tests/unit/profile/validation.test.ts`
- Create: `02-project/app/tests/unit/api/session.test.ts`

**Interfaces:**
- Produces:
  - `updateSessionUser(patch: Partial<SessionUser>): SessionUser | null` and `subscribeSession(cb: () => void): () => void` in `src/lib/api/session.ts`
  - `ProfileMe`, `UpdateProfileInput`, `ChangePasswordInput`, `apiGetMe()`, `apiUpdateMe()`, `apiChangePassword()` in `src/lib/api/profile.ts`
  - `validateProfileForm(values)` and `validateChangePasswordForm(values)` in `src/lib/profile/validation.ts`

- [ ] **Step 1: Write failing unit tests for profile validation and session reactivity**

Create `02-project/app/tests/unit/profile/validation.test.ts` and `02-project/app/tests/unit/api/session.test.ts`:
- `validateProfileForm`: rejects empty/whitespace `name`, rejects invalid `email`, rejects `phone` shorter than 8 chars, accepts empty optional `email`/`phone` and valid values.
- `validateChangePasswordForm`: requires `currentPassword`, requires `newPassword` >= 8 chars, rejects `newPassword === currentPassword`, rejects mismatched `confirmPassword`, accepts valid payload.
- `session.ts`: `updateSessionUser` preserves storage choice (`localStorage` vs `sessionStorage`), merges `patch`, and notifies `subscribeSession` listeners; `saveSession` & `clearSession` also notify listeners.

- [ ] **Step 2: Run Vitest to verify tests fail**

Run: `cd 02-project/app && pnpm test:unit tests/unit/profile/validation.test.ts tests/unit/api/session.test.ts`
Expected: FAIL (missing modules/exports).

- [ ] **Step 3: Implement `session.ts`, `auditEvents.ts`, `profile.ts`, and `validation.ts`**

- Update `02-project/app/src/lib/api/session.ts` with `updateSessionUser`, `subscribeSession`, and event dispatch (`pharmastock:session-change`) on `saveSession`, `updateSessionUser`, and `clearSession`.
- Add `profile_update` and `password_change` to `AUDIT_ACTIONS` in `02-project/app/src/lib/domain/auditEvents.ts`.
- Create `02-project/app/src/lib/api/profile.ts` using `apiRequest` from `./http`.
- Create `02-project/app/src/lib/profile/validation.ts`.

- [ ] **Step 4: Run unit tests to verify pass**

Run: `cd 02-project/app && pnpm test:unit tests/unit/profile/validation.test.ts tests/unit/api/session.test.ts tests/unit/audit/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 02-project/app/src/lib/api/session.ts 02-project/app/src/lib/domain/auditEvents.ts 02-project/app/src/lib/api/profile.ts 02-project/app/src/lib/profile/validation.ts 02-project/app/tests/unit/profile/validation.test.ts 02-project/app/tests/unit/api/session.test.ts
git commit -m "feat(frontend): add profile API client, validation, and reactive session helpers"
```

---

### Task 3: Unified `UserMenu` in `TopHeader` & Remove Hardcoded Avatars

**Files:**
- Create: `02-project/app/src/components/layout/user-menu.tsx`
- Modify: `02-project/app/src/components/layout/top-header.tsx`
- Modify: `02-project/app/src/components/layout/index.ts`
- Modify: `02-project/app/src/app/dashboard/dashboard-view.tsx`
- Modify: `02-project/app/src/app/dashboard-inventory/dashboard-inventory-view.tsx`
- Modify: `02-project/app/src/app/drug-catalog/drug-catalog-view.tsx`
- Modify: `02-project/app/src/app/drug-details-cardex/drug-details-view.tsx`
- Modify: `02-project/app/src/app/shelf-inventory/shelf-inventory-view.tsx`
- Modify: `02-project/app/src/app/expiry-alerts-fefo/expiry-alerts-view.tsx`
- Create: `02-project/app/tests/unit/layout/user-menu.test.tsx`
- Modify: `02-project/app/tests/unit/layout/top-header.test.tsx`

**Interfaces:**
- Consumes: `getSessionUser`, `clearSession`, `subscribeSession` (`src/lib/api/session.ts`), `getAuditRoleLabel` (`src/lib/domain/auditEvents.ts`), `Popover` (`src/components/ui/popover.tsx`)
- Produces: `UserMenu` exported from `@/components/layout` and rendered by `TopHeader`

- [ ] **Step 1: Write failing tests for `UserMenu` and `TopHeader`**

- In `02-project/app/tests/unit/layout/user-menu.test.tsx`:
  - Renders fallback initial when unauthenticated, and user's first initial when `sessionUser` is present.
  - Clicking trigger opens popover showing `user.name`, Persian role label, link to `/profile` (`پروفایل من`), and button `خروج از حساب`.
  - Clicking `خروج از حساب` calls `clearSession()` and navigates to `/login`.
- In `02-project/app/tests/unit/layout/top-header.test.tsx`:
  - Assert `TopHeader` renders `<UserMenu />` trigger even when custom `actions` prop is provided.

- [ ] **Step 2: Run tests to verify failure**

Run: `cd 02-project/app && pnpm test:unit tests/unit/layout/user-menu.test.tsx tests/unit/layout/top-header.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `UserMenu`, integrate into `TopHeader`, and clean up 6 hardcoded avatars**

- Implement `02-project/app/src/components/layout/user-menu.tsx` using `useSyncExternalStore` (with cached snapshot or mount flag so SSR matches initial client render) and `subscribeSession` to stay synced when profile name changes.
- Export `UserMenu` in `02-project/app/src/components/layout/index.ts`.
- Update `02-project/app/src/components/layout/top-header.tsx`: remove static `<span>ا</span>` from default `actions` and render `<UserMenu />` at the end of `top-header-actions` always.
- Remove the hardcoded `<span ... aria-label="دکتر رضایی">ر</span>` from `dashboard-view.tsx`, `dashboard-inventory-view.tsx`, `drug-catalog-view.tsx`, `drug-details-view.tsx`, `shelf-inventory-view.tsx`, and `expiry-alerts-view.tsx`.

- [ ] **Step 4: Run layout & smoke unit tests**

Run: `cd 02-project/app && pnpm test:unit tests/unit/layout/user-menu.test.tsx tests/unit/layout/top-header.test.tsx tests/unit/layout/app-shell.test.tsx tests/unit/smoke.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 02-project/app/src/components/layout 02-project/app/src/app/dashboard/dashboard-view.tsx 02-project/app/src/app/dashboard-inventory/dashboard-inventory-view.tsx 02-project/app/src/app/drug-catalog/drug-catalog-view.tsx 02-project/app/src/app/drug-details-cardex/drug-details-view.tsx 02-project/app/src/app/shelf-inventory/shelf-inventory-view.tsx 02-project/app/src/app/expiry-alerts-fefo/expiry-alerts-view.tsx 02-project/app/tests/unit/layout
git commit -m "feat(layout): add unified UserMenu in TopHeader and remove hardcoded avatars"
```

---

### Task 4: `/profile` Page (`ProfileView`) + Unit & E2E Tests

**Files:**
- Create: `02-project/app/src/app/profile/page.tsx`
- Create: `02-project/app/src/app/profile/profile-view.tsx`
- Create: `02-project/app/tests/unit/profile/profile-view.test.tsx`
- Create: `02-project/app/tests/e2e/profile.spec.ts`

**Interfaces:**
- Consumes: `AppShell`, `PageHeader`, `apiGetMe`, `apiUpdateMe`, `apiChangePassword`, `updateSessionUser`, `validateProfileForm`, `validateChangePasswordForm`, `getAuditRoleLabel`, `formatJalaliDate`, `formatPersianTime`, `toPersianDigits`.

- [ ] **Step 1: Write failing component tests for `ProfileView`**

In `02-project/app/tests/unit/profile/profile-view.test.tsx` (mocking `@/lib/api/profile`, `@/lib/api/session`, `next/navigation`, `sonner`):
- Renders Persian main heading `<h1>پروفایل و تنظیمات حساب کاربری</h1>` and read-only organizational fields (username, role label, branchNameFa, unitLabel, personnelCode, medicalCouncilNo, last login info).
- Submitting empty `name` shows inline validation error and does not call `apiUpdateMe`.
- Submitting valid profile edits calls `apiUpdateMe`, calls `updateSessionUser({ name })`, and shows success toast.
- Submitting mismatched confirm password or short password shows inline validation error and does not call `apiChangePassword`.
- Submitting valid password change calls `apiChangePassword`, clears password fields, and shows success toast.
- API load error displays `AlertBanner` with retry button.

- [ ] **Step 2: Run test to verify failure**

Run: `cd 02-project/app && pnpm test:unit tests/unit/profile/profile-view.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `/profile` (`page.tsx` & `profile-view.tsx`)**

- `02-project/app/src/app/profile/page.tsx`: metadata (`پروفایل کاربری | انبار دارو`) + `Suspense` wrapping `<AppShellPageFallback message="در حال بارگذاری پروفایل کاربری…" />` + `<ProfileView />`.
- `02-project/app/src/app/profile/profile-view.tsx`:
  - `AppShell` with `navItems={getAppNavItems()}` and `header={{ branchLabel: profile?.branchNameFa || 'شعبه مرکزی' }}`.
  - `PageHeader` with `داشبورد / پروفایل کاربری` breadcrumbs and `<h1>پروفایل و تنظیمات حساب کاربری</h1>`.
  - Read-only identity & organizational card + last login security card (`lg:col-span-5`).
  - Editable profile info card + change password card with show/hide password toggles (`lg:col-span-7`).

- [ ] **Step 4: Add Playwright E2E test (`02-project/app/tests/e2e/profile.spec.ts`)**

- Intercept `/api/v1/auth/me` (GET/PATCH) and `/api/v1/auth/change-password` (POST), seed `sessionStorage` with token + `SessionUser`, verify:
  - Opening `UserMenu` in header navigates to `/profile`
  - Updating name updates the header menu name
  - Changing password shows success toast
  - Clicking «خروج از حساب» clears session and redirects to `/login`.

- [ ] **Step 5: Run full verification suite**

Run:
- `cd 02-project/app/backend && go test ./...`
- `cd 02-project/app && pnpm test:unit`
- `cd 02-project/app && pnpm exec tsc --noEmit`
- `cd 02-project/app && pnpm test:e2e tests/e2e/profile.spec.ts tests/e2e/shell.spec.ts`
Expected: All unit tests, Go tests, typecheck, and E2E tests PASS.

- [ ] **Step 6: Commit**

```bash
git add 02-project/app/src/app/profile 02-project/app/tests/unit/profile/profile-view.test.tsx 02-project/app/tests/e2e/profile.spec.ts
git commit -m "feat(profile): implement /profile page with unit and e2e tests"
```

---

## Self-Review

- **Spec coverage:** Backend `/auth/me` (GET/PATCH) & `/auth/change-password` (POST) -> Task 1; Reactive `SessionUser` & validation -> Task 2; `UserMenu` in `TopHeader` & removing 6 hardcoded avatars -> Task 3; `/profile` page & tests -> Task 4. All spec goals covered.
- **Type consistency:** `MeResponse` fields match `ProfileMe` (`id`, `username`, `name`, `email`, `phone`, `personnelCode`, `medicalCouncilNo`, `role`, `branchId`, `branchNameFa`, `unitLabel`, `status`, `lastLoginAt`, `lastLoginIp`, `lastLoginDevice`, `createdAt`, `updatedAt`).
- **Review focus coverage:** Empty name, wrong current password, short/identical new password, hydration safety in `UserMenu`, and `TopHeader` custom `actions` + `UserMenu` are all explicitly tested.
