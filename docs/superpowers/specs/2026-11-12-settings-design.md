# Design: `settings` (تنظیمات سیستم و داروخانه)

**Date:** 2026-11-12  
**Stage:** Design → Plan → Build  
**Status:** Brainstormed & Approved (Approach 1: Full-stack persisted settings with RBAC & Audit)  
**Route:** `/settings`  
**Backend:** Go Echo `internal/settings` + MongoDB `settings` collection + Audit Log  

---

## 1. Goal

Provide a unified, production-grade **Settings** interface (`/settings`) for **PharmaStock (انبار دارو)** that centralizes pharmacy identity, clinical inventory rules (FEFO & reorder thresholds), external TTAC gateway settings, and audit/session controls. All main headings are in Persian, configuration is persisted in MongoDB, changes require appropriate RBAC privileges (`super_admin` or `technical_officer`), and updates are tracked in the immutable `audit_events` log.

---

## 2. Approaches Considered & Trade-offs

| Approach | Description | Pros | Cons | Verdict |
|----------|-------------|------|------|---------|
| **Approach 1: Full-stack Mongo + RBAC + Audit (Chosen)** | Dedicated `internal/settings` Go module with GET/PUT, fallback defaults, permission checks (`settings:read`, `settings:write`), audit logging, and Next.js tabbed UI. | Real persistence, enterprise-grade auditability, updates reflected across shell/headers, fits clinical workflow. | Requires touching backend router + frontend data access. | **Selected (User Choice)** |
| **Approach 2: Frontend-only localStorage** | Store preferences only in browser client state without Go backend changes. | Fastest to build, zero backend changes. | Changes don't persist across users/devices, violates multi-user pharmacy workflow, not auditable. | Rejected |
| **Approach 3: Static config viewer** | Read-only dashboard showing current `.env` variables without mutation capability. | Simple. | Doesn't allow pharmacists or admins to configure thresholds, printer footers, or branch data in runtime. | Rejected |

---

## 3. Scope & Tabs Structure

The page `/settings` uses a clean 4-tab clinical layout:

### تب ۱: هویت داروخانه و چاپ اسناد (Pharmacy Identity & Print)
- **نام داروخانه / شعبه:** نام رسمی شعبه فعال (مثلاً «داروخانه دکتر حسینی (مرکزی)» که در هدر سیستم نمایش داده می‌شود).
- **شماره پروانه / کد نظام پزشکی مسئول فنی:** درج در سربرگ اسناد رسمی.
- **تلفن تماس و آدرس ثبتی داروخانه.**
- **پاورقی اسناد چاپی:** متن توضیحات پیش‌فرض ذیل رسید انبار، حواله خروج و برگه‌های مغایرت انبارگردانی.

### تب ۲: قوانین انبار، FEFO و سفارش‌گذاری (Inventory, FEFO & Reorder Rules)
- **آستانه‌های انقضا (روز):**
  - بحرانی (Critical): پیش‌فرض ۳۰ روز
  - هشدار (Warning): پیش‌فرض ۹۰ روز
  - پایش (Watch): پیش‌فرض ۱۸۰ روز
- **آستانه‌های پوشش روزانه سفارش خودکار (Days of Cover):**
  - بحرانی (Critical): ۲ روز
  - کم (Low): ۵ روز
  - بازه بازسفارش استاندارد: ۱۴ روز
  - ضریب ایمنی پیش‌فرض (Safety Stock Factor): مثلاً ۱.۲
- **سیاست‌های سخت‌گیرانه (Strict Policies - Toggles):**
  - الزام خروج قطعی بر مبنای FEFO (جلوگیری از حواله بچ دیرتر هنگام وجود بچ زودتر مگر با مجوز).
  - الزام تایید دوم مسئول فنی برای داروی مخدر و تحت کنترل.

### تب ۳: سامانه تیتک (TTAC Integration)
- **آدرس پایه وب‌سرویس تیتک (TTAC Gateway Base URL).**
- **مهلت زمانی درخواست (Timeout بر حسب ثانیه/میلی‌ثانیه).**
- **مدت زمان ماندگاری کش استعلامات محلی (Cache TTL به ساعت).**
- **سوئیچ فعال/غیرفعال بودن استعلام زنده.**
- **دکمه اقدام سریع:** «آزمون اتصال به سامانه تیتک» (Healthcheck Ping / Test).

### تب ۴: امنیت، نشست و ممیزی (Security & Session)
- **مدت اعتبار نشست (Session Timeout - به ساعت).**
- **سیاست ثبت وقایع:** لاگ تمام تغییرات دسترسی و تغییر موجودی با وضعیت فعال/غیرفعال.
- **نمایش اطلاعات سیستمی:** نسخه سامانه، شناسه دیتابیس، وضعیت اتصال بک‌اند و تاریخ آخرین تغییر تنظیمات.

---

## 4. Architecture & Data Contracts

### 4.1 Backend (Go Echo + MongoDB)

- **Collection:** `settings` (تک سند سیستمی با شناسه ثابت `default` یا `singleton`).
- **Entity (`internal/settings/entity.go`):**
  ```go
  type Settings struct {
      ID                string           `bson:"_id" json:"id"`
      PharmacyIdentity  PharmacyIdentity `bson:"pharmacyIdentity" json:"pharmacyIdentity"`
      InventoryRules    InventoryRules   `bson:"inventoryRules" json:"inventoryRules"`
      TTACIntegration   TTACIntegration  `bson:"ttacIntegration" json:"ttacIntegration"`
      SecurityConfig    SecurityConfig   `bson:"securityConfig" json:"securityConfig"`
      UpdatedAt         time.Time        `bson:"updatedAt" json:"updatedAt"`
      UpdatedBy         string           `bson:"updatedBy" json:"updatedBy"`
  }
  ```
- **Endpoints:**
  - `GET /api/v1/settings` — عمومی/احراز هویت شده، برگرداندن تنظیمات جاری یا پیش‌فرض‌های سیستمی.
  - `PUT /api/v1/settings` — نیازمند احراز هویت با دسترسی ادمین یا مسئول فنی (`super_admin` / `technical_officer`). ذخیره در دیتابیس و ثبت رویداد در `audit_events` با نوع `settings_update`.
  - `POST /api/v1/settings/test-ttac` — شبیه‌سازی تست اتصال به وب‌سرویس TTAC و گزارش تأخیر زمانی (Latency).

### 4.2 Frontend (Next.js App Router + TypeScript)

- **صفحه جدید:** `src/app/settings/page.tsx` و `src/app/settings/settings-view.tsx`.
- **اضافه به منوی ناوبری سایدبار (`src/lib/nav/app-nav.ts`):** آیتم جدید «تنظیمات سیستم» با آیکون `settings`.
- **سرویس دسترسی داده:** `src/lib/settings/data-access.ts` (با پشتیبانی کامل از API بک‌اند و فال‌بک موک بهینه برای حالت تست آفلاین).
- **تیترهای اصلی به فارسی:**
  - `تنظیمات سیستم و انبار دارو`
  - `پیکربندی هویت داروخانه، قوانین FEFO، ارتباط با سامانه‌ها و کنترل‌های امنیتی`
  - عناوین تب‌ها و دکمه‌ها تماماً فارسی و منطبق با طراحی تمیز کلینیکال PharmaStock.

---

## 5. Verification & Testing

1. **تست‌های واحد بک‌اند (Go):**
   - تست بارگذاری پیش‌فرض‌ها در صورت نبود رکورد در دیتابیس.
   - تست ذخیره و بازیابی فیلدهای تنظیمات.
   - تست اعتبارسنجی مقادیر (مثلاً بازه روزهای انقضا نباید منفی باشد).
   - تست دسترسی و ممیزی رویداد.
2. **تست‌های فرانت‌اند (Vitest / Playwright):**
   - تست رندر تب‌ها و فرم‌ها.
   - تست ثبت فرم و نمایش توست موفقیت.
   - تست رندر صحیح تیترهای فارسی و هدر.
3. **سازگاری با کل سیستم:**
   - عدم ایجاد شکست در سایر صفحات یا تست‌های موجود.
