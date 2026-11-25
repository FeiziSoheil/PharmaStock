# Design: صفحه پروفایل کاربری و منوی کاربر در هدر (`/profile`)

**Date:** 2026-11-12  
**Stage:** Design  
**Status:** Ready for user approval  
**Scope:** Backend self-service `/auth/me` & `/auth/change-password`, Frontend `/profile` page, and unified `UserMenu` in `TopHeader`

---

## 1. Intent & Why

Currently, PharmaStock has full admin user management (`/users-permissions`) and JWT-based authentication (`POST /api/v1/auth/login`), but:
- There is no `/profile` page where a logged-in pharmacist or warehouse operator can view their account details, update their display name/contact info, or change their own password.
- The avatar in `TopHeader` is a static, non-interactive badge (`ا` in `top-header.tsx`, or hardcoded `ر` for «دکتر رضایی» in six page views) with no link to a profile page or logout action.

Goal: Give every authenticated user a clean, Persian-first self-service profile page (`/profile`) and a real, unified user menu in the top header bar across the app.

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- View own identity & organizational details (read-only: `username`, `role`, `branch`, `unitLabel`, `personnelCode`, `medicalCouncilNo`, `status`, and last login metadata).
- Update own editable fields (`name`, `email`, `phone`) via `PATCH /api/v1/auth/me`, syncing `SessionUser` in browser storage so the header updates immediately.
- Change own password via `POST /api/v1/auth/change-password` with mandatory current-password verification.
- Record profile updates and password changes in the audit log (`audit_events`).
- Replace static/hardcoded header avatars with an interactive `UserMenu` (`Popover`) in `TopHeader` showing the logged-in user's name/role, «پروفایل من» link, and «خروج از حساب» action.

### Non-Goals
- Self-editing `role`, `branchId`, `unitLabel`, `personnelCode`, `medicalCouncilNo`, or `username` (regulated pharmacy governance keeps those under admin `/users-permissions`).
- Branch switching, avatar image upload, 2FA/MFA, or digital seal management.
- Adding a dedicated sidebar link for `/profile` (reachable via the header user menu and direct URL).

### Anti-Goals
- Reusing admin `POST /api/v1/users/:id/reset-password` for self-service password change (bypasses current-password check).
- Exposing `passwordHash`, `failedAttempts`, or `lockUntil` in any API response.

## 3. Approaches Considered

1. **Approach 1 (Selected): Dedicated self-service endpoints (`/api/v1/auth/me` & `/api/v1/auth/change-password`) + unified `UserMenu` in `TopHeader`**
   - *Trade-off:* Adds 3 focused endpoints and tests in `backend/internal/auth`, plus removes hardcoded avatars from 6 frontend views.
   - *Why chosen:* Clean separation between self-service and admin RBAC, enforces current-password verification, and makes the header user menu consistent across all pages.
2. **Approach 2 (Rejected): Reuse `/api/v1/users/:id` & `/reset-password`**
   - *Trade-off:* Skips backend changes, but lacks current-password verification and couples self-service edits to admin-only fields (`role`, `branchId`, `personnelCode`).

## 4. Architecture & Design

### 4.1 Backend (`backend/internal/auth` & `backend/cmd/api/bootstrap/routes.go`)

Register under `secured := api.Group("", mw.JWT(r.JWT))`:
- `GET /api/v1/auth/me` -> `r.Auth.Me`
- `PATCH /api/v1/auth/me` -> `r.Auth.UpdateMe`
- `POST /api/v1/auth/change-password` -> `r.Auth.ChangePassword`

**DTOs (`auth/dto.go`):**
- `MeResponse`:
  - `id`, `username`, `name`, `email`, `phone`, `personnelCode`, `medicalCouncilNo`, `role`, `branchId`, `branchNameFa`, `unitLabel`, `status`, `lastLoginAt`, `lastLoginIp`, `lastLoginDevice`, `createdAt`, `updatedAt`.
- `UpdateMeRequest`: `name` (required, non-empty after trim), `email` (optional, valid format if provided), `phone` (optional, min 8 chars if provided).
- `ChangePasswordRequest`: `currentPassword` (required), `newPassword` (required, min 8 chars, must differ from `currentPassword`).
- `ChangePasswordResponse`: `{ ok: true, message: "رمز عبور با موفقیت تغییر یافت" }`.

**Repository & Service (`auth/repository.go`, `auth/service.go`):**
- Use an interface for `auth` store/audit dependencies or testable store methods so `auth/service_test.go` and `auth/handler_test.go` can run cleanly without requiring live MongoDB (matching `users/service_test.go` / `returns/handler_test.go` patterns).
- `UpdateMe` normalizes `nameNorm` via `validator.NormalizeFa` and records an audit event (`EntityType: "user"`, `Action: "profile_update"` or `"user_update"`, `Severity: "info"`).
- `ChangePassword` verifies `bcrypt.CompareHashAndPassword`, hashes with `bcrypt.DefaultCost`, clears `failedAttempts`/`lockUntil` if any, and records an audit event (`Severity: "warning"`, `Description: "تغییر رمز عبور توسط کاربر"`).

### 4.2 Frontend

**API & Validation:**
- `src/lib/api/session.ts`: add `updateSessionUser(patch)` and a lightweight custom event (`pharmastock:session-updated`) + `subscribeSessionUser` helper so `TopHeader` stays reactive when the user updates their name.
- `src/lib/api/profile.ts`: `ProfileMe` type + `apiGetMe()`, `apiUpdateMe()`, `apiChangePassword()`.
- `src/lib/profile/validation.ts`: pure validation helpers for profile form (`name`, `email`, `phone`) and password form (`currentPassword`, `newPassword`, `confirmPassword`).

**Header User Menu (`src/components/layout/user-menu.tsx` & `top-header.tsx`):**
- `UserMenu` reads `SessionUser` safely on client mount (hydration-safe via `useSyncExternalStore` or mount effect) with graceful fallback when unauthenticated in component galleries/tests.
- Button shows user's first initial inside the existing circular primary-tint avatar (`size-9 rounded-full bg-primary-tint text-primary`).
- Clicking opens a clinical `Popover` displaying:
  - User `name` + Persian role label (e.g. `داروساز مسئول فنی`)
  - Link button: «پروفایل من» (`/profile`)
  - Destructive/ghost button: «خروج از حساب» (`clearSession()` + `router.push('/login')`)
- `TopHeader` renders `<UserMenu />` at the trailing end of `top-header-actions` regardless of whether `actions` is customized, and the 6 views (`dashboard`, `dashboard-inventory`, `drug-catalog`, `drug-details-cardex`, `shelf-inventory`, `expiry-alerts-fefo`) drop their hardcoded «دکتر رضایی» `<span>` avatar from `actions`.

**Profile Page (`src/app/profile/page.tsx` & `src/app/profile/profile-view.tsx`):**
- Wrapped in `AppShell` (`navItems={getAppNavItems()}`) with `Suspense` + `AppShellPageFallback`.
- `PageHeader`: breadcrumb `داشبورد / پروفایل کاربری` and Persian `<h1>` title `پروفایل و تنظیمات حساب کاربری`.
- Two-column desktop layout (`grid-cols-1 lg:grid-cols-12 gap-6`):
  - **Right column (`lg:col-span-5` in RTL):**
    1. **کارت هویت و اطلاعات سازمانی (فقط‌خواندنی):** آواتار، نام کامل، نام کاربری (`dir="ltr"`), نقش سازمانی (Badge)، وضعیت حساب (`TriageStatusBadge` یا Badge)، شعبه، واحد سازمانی، کد پرسنلی، شماره نظام پزشکی.
    2. **کارت امنیت ورود و آخرین نشست:** آخرین زمان ورود (تاریخ و ساعت شمسی)، IP ورود، دستگاه/مرورگر.
  - **Left column (`lg:col-span-7` in RTL):**
    1. **کارت ویرایش اطلاعات فردی و تماس:** نام و نام خانوادگی، ایمیل، شماره تماس + دکمه «ذخیره تغییرات» با toast و اعتبارسنجی inline.
    2. **کارت تغییر رمز عبور:** رمز عبور فعلی، رمز عبور جدید، تکرار رمز عبور جدید (با دکمه نمایش/مخفی کردن هر فیلد) + دکمه «تغییر رمز عبور».

## 5. Verification Plan

- Backend Go unit/handler tests (`go test ./internal/auth/...`).
- Frontend Vitest unit tests for `src/lib/profile/validation.ts`, `src/lib/api/session.ts`, `UserMenu` / `TopHeader`, and `ProfileView`.
- Next.js build/typecheck (`pnpm build` or `pnpm exec tsc --noEmit`) + Playwright E2E check for `/profile` and header `UserMenu` navigation/logout.
