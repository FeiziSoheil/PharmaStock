# مستندات جامع سامانه انبار دارو · PharmaStock

**انبار دارو (PharmaStock)** یک سامانه تمام‌متن (Full-Stack) مدیریت انبار و موجودی داروخانه با پشتیبانی بومی از زبان فارسی (`dir="rtl"`)، تقویم شمسی (جلالی)، استعلام تی‌تک (TTAC)، منطق خروج FEFO، کاردکس گردش دارو، دفترچه داروهای تحت کنترل/مخدر، و گزارش ممیزی تغییرناپذیر است.

---

## ۱. نمای کلی و معماری سامانه

پروژه به صورت دو بخش مستقل در یک مخزن (Monorepo) سازمان‌دهی شده است:

```text
PharmaStock/
├── README.md                 # معرفی سریع و راهنمای راه‌اندازی
├── backend/                  # سرویس API به زبان Go (Echo + MongoDB)
│   ├── cmd/api/              # نقطه ورود سرویس و Bootstrap مسیرها
│   ├── internal/             # ماژول‌های دامنه (Clean/Modular per domain)
│   ├── pkg/                  # پکیج‌های زیرساختی (config, database, jwt, middleware, validator, ...)
│   ├── scripts/seed/         # اسکریپت مستقل درج داده‌های نمونه
│   ├── docker-compose.yml    # اجرای MongoDB و API در Docker
│   └── Makefile              # دستورات build، test، run، seed و compose
├── frontend/                 # رابط کاربری Next.js (App Router + TypeScript + Tailwind v4)
│   ├── src/app/              # صفحات App Router (۱۷ مسیر عملیاتی + پروفایل و ابزارهای طراحی)
│   ├── src/components/       # کامپوننت‌های پایه UI، چیدمان (Floating Shell) و دامنه‌ای
│   ├── src/lib/              # کلاینت‌های API، facadeهای داده، ابزارهای فارسی/جلالی و نوع‌ها
│   └── tests/                # تست‌های واحد (Vitest) و سرتاسری (Playwright E2E)
└── docs/                     # مستندات فنی، طراحی و مرجع
    ├── DOCUMENTATION.md      # همین سند (مستند جامع پروژه)
    ├── backend/              # قراردادهای API و اتصال فرانت‌اند به بک‌اند
    ├── design-system/        # وضعیت سیستم طراحی و توکن‌ها
    ├── design-tokens.md      # مستند توکن‌های طراحی
    ├── stitch-reference/     # رفرنس‌های بصری و HTML صفحات
    └── superpowers/          # مشخصات و برنامه‌های پیاده‌سازی ماژول‌ها
```

### جریان داده (Data Flow)
- **فرانت‌اند همیشه به Go API متصل است:** آدرس پایه از متغیر محیطی `NEXT_PUBLIC_API_BASE_URL` (پیش‌فرض: `http://localhost:8080`) خوانده می‌شود.
- **الگوی دسترسی به داده در فرانت‌اند:**
  1. صفحه (`src/app/<route>/page.tsx` و `*-view.tsx`)
  2. لایه Facade (`src/lib/<domain>/data-access.ts`)
  3. کلاینت HTTP (`src/lib/api/<module>.ts` روی `src/lib/api/http.ts`) با تزریق خودکار توکن `Authorization: Bearer <token>`
- **الگوی لایه‌ای در بک‌اند Go:**
  1. `bootstrap.New` در `backend/cmd/api/bootstrap/app.go` اتصال MongoDB، ایندکس‌ها، Middlewareها (Recover, RequestID, Logger, CORS) و سرویس‌ها را مقداردهی می‌کند.
  2. `RegisterRoutes` در `backend/cmd/api/bootstrap/routes.go` اندپوینت‌ها را ثبت و زیرگروه `/api/v1` را با `mw.JWT` محافظت می‌کند.
  3. هر ماژول در `internal/<domain>` معمولاً شامل فایل‌های `entity.go`، `dto.go`، `repository.go`، `service.go` و `handler.go` (به‌همراه تست‌های `*_test.go`) است.

---

## ۲. پشته فناوری (Tech Stack)

### بک‌اند و پایگاه داده
| بخش | فناوری / کتابخانه | نسخه | کاربرد |
|---|---|---|---|
| زبان | Go | `1.23.0` | سرویس API و منطق تجاری |
| فریم‌ورک وب | `github.com/labstack/echo/v4` | `v4.13.3` | روتینگ، Middleware و Error Handling |
| پایگاه داده | MongoDB (`mongo:7`) | `go.mongodb.org/mongo-driver v1.17.3` | ذخیره‌سازی اسناد و ایندکس‌ها |
| احراز هویت | `github.com/golang-jwt/jwt/v5` | `v5.2.1` | صدور و اعتبارسنجی توکن JWT |
| رمزنگاری | `golang.org/x/crypto` | `v0.36.0` | هش رمز عبور با `bcrypt` |
| شناسه یکتا | `github.com/google/uuid` | `v1.6.0` | تولید شناسه‌ها |

### فرانت‌اند
| بخش | فناوری / کتابخانه | نسخه | کاربرد |
|---|---|---|---|
| فریم‌ورک | Next.js (App Router + Turbopack) | `16.4.6` | رندرینگ و مسیریابی صفحات |
| کتابخانه UI | React / React DOM | `19.3.1` | رابط کاربری کامپوننت‌محور |
| زبان | TypeScript | `5.9.3` | تایپ‌سیفتی استاتیک |
| استایل‌دهی | Tailwind CSS (`@tailwindcss/postcss`) | `4.3.5` | استایل‌های Utility و توکن‌های تم |
| کامپوننت‌ها | `radix-ui`, `sonner`, `react-day-picker`, `date-fns` | — | دیالوگ‌ها، اعلان‌ها، انتخابگر تاریخ |
| تایپوگرافی و آیکون | `@fontsource-variable/vazirmatn`, `@fontsource-variable/inter`, `material-symbols` | — | فونت فارسی/لاتین و آیکون‌های Material |
| تست واحد | Vitest + Testing Library + jsdom | `5.1.0` | تست کامپوننت‌ها و منطق دامنه |
| تست E2E | Playwright | `1.65.0` | تست‌های سرتاسری مرورگر |

---

## ۳. ماژول‌ها و صفحات فرانت‌اند

رابط کاربری با جهت پیش‌فرض راست‌به‌چپ (`lang="fa" dir="rtl"`) و از طریق `src/lib/nav/app-nav.ts` در ۵ گروه اصلی سازمان‌دهی شده است:

| دسته | مسیر (Route) | عنوان فارسی | توضیح عملکرد |
|---|---|---|---|
| عمومی / حساب | `/login` | ورود به سامانه | احراز هویت با نام کاربری، رمز عبور، انتخاب شعبه و کپچای سمت کلاینت |
| عمومی / حساب | `/profile` | پروفایل کاربر | مشاهده و ویرایش اطلاعات کاربری و تغییر رمز عبور |
| ۱. پیشخوان و آمار | `/dashboard` | داشبورد و آمار | نمای کلی شاخص‌های کلیدی عملکرد، هشدارها و وضعیت انبار |
| ۱. پیشخوان و آمار | `/dashboard-inventory` | داشبورد و موجودی انبار | پایش موجودی لحظه‌ای، عملیات ورود سریع (`stock-in`) و تغییر وضعیت گروهی |
| ۲. اطلاعات پایه و کاتالوگ | `/drug-catalog` | کاتالوگ دارو | مدیریت فهرست داروها، جستجوی ژنریک/GTIN و استعلام/جستجوی TTAC + خروجی CSV |
| ۲. اطلاعات پایه و کاتالوگ | `/drug-details-cardex` | جزئیات دارو و کاردکس | پروفایل دارو، سری‌ساخت‌ها (Batch)، جابجایی قفسه و جدول گردش کاردکس |
| ۲. اطلاعات پایه و کاتالوگ | `/shelf-inventory` | موجودی فیزیکی قفسه‌ها | مشاهده قفسه‌ها/جایگاه‌ها (Bins) بر اساس زون و چاپ برچسب قفسه |
| ۳. ورود و خروج کالا | `/invoice-receipts` | ورود فاکتور و رسید انبار | ثبت پیش‌نویس فاکتور خرید، افزودن اقلام (با پیش‌پرکردن TTAC) و تأیید نهایی به کاردکس |
| ۳. ورود و خروج کالا | `/purchase-invoice-reconciliation` | فاکتور خرید (اکسل و تطبیق) | آپلود فایل اکسل/CSV فاکتور، نگاشت ستون‌ها، تطبیق خودکار با کاتالوگ و ثبت نهایی |
| ۳. ورود و خروج کالا | `/dispensing-dispatch` | حواله خروج و فروش | ثبت حواله نسخه/فروش با پیشنهاد خودکار سری‌ساخت بر اساس **FEFO** و تأیید نهایی |
| ۳. ورود و خروج کالا | `/internal-transfer` | انتقال داخلی | انتقال موجودی بین قفسه‌ها یا بخش‌های داخلی به‌صورت پیش‌نویس و تأیید |
| ۳. ورود و خروج کالا | `/distributor-returns` | مرجوعی به شرکت‌های پخش | انتخاب اقلام نزدیک انقضا/معیوب، صدور حواله مرجوعی، تأیید و تسویه مالی |
| ۴. کنترل کیفیت و زنجیره تأمین | `/expiry-alerts-fefo` | هشدارهای انقضا و FEFO | پایش دسته‌های منقضی یا نزدیک به انقضا، تغییر وضعیت (قرنطینه/فعال) و جابجایی |
| ۴. کنترل کیفیت و زنجیره تأمین | `/auto-reorder-suggestions` | پیشنهاد سفارش خودکار | محاسبه نقطه سفارش (ROP)، تنظیمات سفارش‌دهی، پیش‌نویس سفارش خرید (PO) و خروجی |
| ۴. کنترل کیفیت و زنجیره تأمین | `/periodic-stocktake` | انبارگردانی دوره‌ای | تعریف دوره انبارگردانی، ثبت شمارش اول/دوم، بررسی مغایرت و صدور سند تعدیل |
| ۴. کنترل کیفیت و زنجیره تأمین | `/controlled-substances-ledger` | دفترچه داروهای تحت کنترل و مخدر | ثبت زنجیره تغییرناپذیر با شماره ردیف متوالی (`seqNo`) و کد رهگیری قانونی |
| ۵. نظارت و سیستم | `/audit-log` | گزارش و لاگ ممیزی | جستجو در رویدادهای ممیزی با فیلتر تاریخ جلالی و خروجی CSV/JSON/PDF |
| ۵. نظارت و سیستم | `/users-permissions` | مدیریت کاربران و دسترسی‌ها | مدیریت کاربران، بازنشانی رمز عبور و ویرایش ماتریس RBAC با قفل‌های قانونی |
| ۵. نظارت و سیستم | `/settings` | تنظیمات سیستم | پیکربندی عمومی داروخانه، تنظیمات ظاهری/تم و تست اتصال TTAC |

> مسیرهای `/domain`، `/components`، `/tokens` و `/shell` برای نمایش و بررسی توکن‌ها و کامپوننت‌های طراحی در دسترس هستند و در منوی کناری اصلی نمایش داده نمی‌شوند. صفحه ریشه `/` در صورت وجود توکن به `/dashboard` و در غیر این صورت به `/login` هدایت می‌شود.

---

## ۴. احراز هویت، نقش‌ها و ماتریس دسترسی (RBAC)

### مکانیزم احراز هویت
- ورود از طریق `POST /api/v1/auth/login` با نام کاربری، رمز عبور و `branchId` انجام می‌شود.
- سرور پس از بررسی وضعیت کاربر (فعال بودن و قفل‌نشدن دائم `PermanentlyLocked`) و تطبیق `bcrypt`، یک **JWT** با اعتبار پیش‌فرض ۱۲ ساعت (`JWT_TTL_HOURS=12`) صادر می‌کند.
- تمام اندپوینت‌های `/api/v1/*` (به‌جز `/auth/login` و `/healthz`) نیازمند هدر `Authorization: Bearer <token>` هستند.

### نقش‌های متعارف (Canonical Roles)
تعریف‌شده در `backend/internal/users/catalog.go`:

| شناسه نقش | عنوان فارسی | توضیح |
|---|---|---|
| `super_admin` | مدیر سامانه / مؤسس | مدیریت کاربران، تنظیمات و نظارت کامل |
| `technical_officer` | داروساز مسئول فنی | تنها نقش مجاز برای تأیید قانونی داروهای تحت کنترل و مخدر |
| `warehouse_lead` | انباردار داروخانه | مدیریت دریافت، قفسه‌ها، انتقال داخلی و مرجوعی |
| `dispensing_clerk` | متصدی نسخه و پیشخوان | ثبت حواله خروج نسخه و مشارکت در شمارش انبارگردانی |

> نقش‌های قدیمی‌تر (`warehouse_operator` → `warehouse_lead`، `pharmacist` → `technical_officer`، `intake_clerk` → `dispensing_clerk`) در ماتریس به نقش‌های متعارف نگاشت می‌شوند.

### قفل‌های تفکیک وظایف (Separation of Duties)
ماتریس دسترسی شامل ۱۷ مجوز در ۶ گروه است. برخی سلول‌ها دارای قفل سیستمی/قانونی هستند که هنگام ذخیره ماتریس (`PUT /api/v1/rbac/matrix`) اعتبارسنجی می‌شوند:
- `outbound.controlled_approval` (تأییدیه قانونی داروهای تحت کنترل و مخدر) **به‌طور انحصاری** در اختیار `technical_officer` است و برای `super_admin`، `warehouse_lead` و `dispensing_clerk` قفل (`false`) می‌ماند.
- `security.manage_users` برای `super_admin` همیشه فعال و برای `warehouse_lead` و `dispensing_clerk` غیرفعال است.
- مجوزهای حساس انبارگردانی (`stocktake.approve_adjustment`)، تأیید رسید (`inbound.confirm_receipt`)، تعدیل موجودی (`inventory.adjust`) و مشاهده لاگ ممیزی (`audit.view`) برای `dispensing_clerk` غیرفعال هستند.

### کاربران و شعبه‌های پیش‌فرض (Seed Data)
هنگام اجرای با `SEED_ON_START=true` یا اجرای دستور `make seed`، داده‌های زیر ایجاد/به‌روزرسانی می‌شوند (رمز عبور تمام کاربران دمو از متغیر `DEMO_PASSWORD` خوانده می‌شود؛ مقدار پیش‌فرض: `change-me-demo-only`):

**شعبه‌ها:**
- `branch-central`: داروخانه مرکزی - انبار شماره ۱ (کاردکس کل)
- `branch-cold`: انبار زنجیره سرد (واکسن و بیولوژیک)
- `branch-valiasr`: واحد توزیع و بالینی شعبه ولیعصر
- `branch-er`: ترالی اورژانس و اقلام حیاتی

**کاربران نمونه:**
| نام کاربری | نقش | شعبه | وضعیت |
|---|---|---|---|
| `operator` | `warehouse_operator` | `branch-central` | فعال (کاربر دمو اصلی) |
| `dr.rezaei` | `technical_officer` | `branch-central` | فعال |
| `m.kazemi` | `warehouse_lead` | `branch-central` | فعال |
| `e.yazdani` | `dispensing_clerk` | `branch-valiasr` | فعال |
| `a.hosseini` | `super_admin` | `branch-central` | فعال |
| `locked` | `warehouse_operator` | `branch-central` | غیرفعال / قفل دائم (برای تست خطای قفل حساب) |

---

## ۵. پایگاه داده (MongoDB Collections & Indexes)

سرویس در زمان راه‌اندازی (`pkg/database/mongo.go`) ایندکس‌های کالکشن‌های زیر را به‌صورت خودکار ایجاد می‌کند:

- `users`: ایندکس یکتا روی `username` و ترکیبی `(role, status)`
- `drugs`: ایندکس یکتای sparse روی `gtin` و ایندکس روی `nameFa`، `genericCode`، `category`، `isControlled`
- `bins`: ایندکس یکتا روی `address` و ایندکس روی `zone`
- `stock_batches`: ایندکس روی `(drugId, expiry)`، `binId` و `(status, expiry)`
- `audit_events`: گزارش ممیزی append-only؛ ایندکس روی `timestamp` نزولی، `actor.id` و `action`
- `ttac_cache`: کش استعلام تی‌تک؛ ایندکس یکتای sparse روی `gtin` و `irc` و ایندکس روی `genericCode`
- `cardex_movements`: ایندکس روی `(drugId, timestamp)`
- `invoice_receipts`: ایندکس روی `(status, updatedAt)` و `header.invoiceNo`
- `dispense_orders`: ایندکس روی `(status, updatedAt)`
- `internal_transfers`: ایندکس روی `(status, updatedAt)` و sparse روی `transferNo`
- `controlled_ledger_entries`: ایندکس یکتا روی `seqNo`، `(timestamp, seqNo)`، `(drugId, timestamp)`، `(txType, timestamp)` و sparse روی `trackingCode`
- `purchase_reconciliations`: ایندکس روی `(status, updatedAt)` و `invoiceNo`
- `distributor_returns`: ایندکس روی `(status, updatedAt)`، `(distributorId, updatedAt)` و sparse روی `returnNo`
- (به همراه کالکشن‌های `branches`، `rbac_policies`، تنظیمات و دوره‌های انبارگردانی/سفارش‌گذاری مورد استفاده در سرویس‌های مربوطه)

---

## ۶. مرجع APIهای بک‌اند

تمام مسیرهای API زیر پیشوند `/api/v1` قرار دارند (به‌جز `/healthz`):

### سلامت و احراز هویت
- `GET /healthz` — بررسی سلامت سرویس (`{"status":"ok"}`)
- `POST /api/v1/auth/login` — ورود و دریافت توکن JWT
- `GET /api/v1/auth/me` — دریافت اطلاعات کاربر جاری
- `PATCH /api/v1/auth/me` — ویرایش پروفایل کاربر جاری
- `POST /api/v1/auth/change-password` — تغییر رمز عبور کاربر جاری

### کاتالوگ دارو، TTAC و کاردکس
- `GET /api/v1/drugs` | `GET /api/v1/drugs/:id` | `POST /api/v1/drugs` | `PUT /api/v1/drugs/:id`
- `GET /api/v1/ttac/lookup` — استعلام کد/شناسه TTAC (با کش محلی ۲۴ ساعته در `ttac_cache`)
- `GET /api/v1/ttac/search` — جستجوی فرآورده در TTAC
- `GET /api/v1/drugs/:id/cardex` — مشاهده گردش کاردکس دارو

### قفسه‌ها، انقضا و داشبورد موجودی
- `GET /api/v1/shelves` | `GET /api/v1/shelves/:id`
- `GET /api/v1/expiry-batches` | `POST /api/v1/expiry-batches`
- `PATCH /api/v1/expiry-batches/:batchId/status` | `PATCH /api/v1/expiry-batches/:batchId/location`
- `GET /api/v1/inventory/dashboard` | `GET /api/v1/inventory/export`
- `POST /api/v1/inventory/stock-in` | `POST /api/v1/inventory/bulk-status`

### رسید فاکتور و تطبیق خرید (اکسل)
- `POST /api/v1/receipts` | `GET /api/v1/receipts` | `GET /api/v1/receipts/:id` | `PATCH /api/v1/receipts/:id`
- `POST /api/v1/receipts/:id/lines` | `PATCH /api/v1/receipts/:id/lines/:lineId` | `DELETE /api/v1/receipts/:id/lines/:lineId`
- `POST /api/v1/receipts/:id/confirm`
- `GET /api/v1/reconciliations/template` | `POST /api/v1/reconciliations/upload`
- `GET /api/v1/reconciliations` | `GET /api/v1/reconciliations/:id` | `PATCH /api/v1/reconciliations/:id`
- `PATCH /api/v1/reconciliations/:id/mapping` | `POST /api/v1/reconciliations/:id/rematch`
- `PATCH /api/v1/reconciliations/:id/rows/:rowId` | `DELETE /api/v1/reconciliations/:id/rows/:rowId`
- `POST /api/v1/reconciliations/:id/confirm`

### حواله خروج (FEFO)، انتقال داخلی و مرجوعی
- `GET /api/v1/dispenses/fefo-preview`
- `POST /api/v1/dispenses` | `GET /api/v1/dispenses` | `GET /api/v1/dispenses/:id` | `PATCH /api/v1/dispenses/:id`
- `POST /api/v1/dispenses/:id/lines` | `PATCH /api/v1/dispenses/:id/lines/:lineId` | `DELETE /api/v1/dispenses/:id/lines/:lineId`
- `POST /api/v1/dispenses/:id/clear-lines` | `POST /api/v1/dispenses/:id/confirm`
- `POST /api/v1/transfers` | `GET /api/v1/transfers` | `GET /api/v1/transfers/:id` | `PATCH /api/v1/transfers/:id`
- `POST /api/v1/transfers/:id/lines` | `PATCH /api/v1/transfers/:id/lines/:lineId` | `DELETE /api/v1/transfers/:id/lines/:lineId`
- `POST /api/v1/transfers/:id/clear-lines` | `POST /api/v1/transfers/:id/confirm`
- `GET /api/v1/returns/eligible` | `POST /api/v1/returns` | `GET /api/v1/returns` | `GET /api/v1/returns/:id`
- `POST /api/v1/returns/:id/confirm` | `POST /api/v1/returns/:id/settle`

### سفارش‌گذاری خودکار، انبارگردانی، مخدر، ممیزی، کاربران و تنظیمات
- `GET /api/v1/reorder-suggestions` | `GET /PUT /api/v1/reorder-suggestions/settings`
- `POST /api/v1/reorder-suggestions/export` | `POST /api/v1/reorder-suggestions/draft` | `POST /api/v1/reorder-suggestions/dismiss`
- `GET /api/v1/purchase-orders` | `PATCH /api/v1/purchase-orders/:id/status` | `GET /api/v1/purchase-orders/:id/export`
- `GET /api/v1/stocktakes` | `POST /api/v1/stocktakes` | `GET /api/v1/stocktakes/:id` | `PATCH /api/v1/stocktakes/:id`
- `PATCH /api/v1/stocktakes/:id/items/:itemId` | `POST /api/v1/stocktakes/:id/confirm` | `GET /api/v1/stocktakes/:id/export`
- `GET /api/v1/controlled-ledger` | `POST /api/v1/controlled-ledger` | `GET /api/v1/controlled-ledger/export`
- `GET /api/v1/audit-events` | `GET /api/v1/audit-events/export`
- `GET /api/v1/users` | `GET /api/v1/users/:id` | `POST /api/v1/users` | `PATCH /api/v1/users/:id`
- `PATCH /api/v1/users/:id/status` | `PUT /api/v1/users/:id/permissions` | `POST /api/v1/users/:id/reset-password`
- `GET /PUT /api/v1/rbac/matrix`
- `GET /PUT /api/v1/settings` | `POST /api/v1/settings/test-ttac`

---

## ۷. متغیرهای محیطی (Environment Variables)

### بک‌اند (`backend/.env.example` و `backend/pkg/config/config.go`)
| متغیر | مقدار پیش‌فرض در کد | توضیح |
|---|---|---|
| `HTTP_ADDR` | `:8080` | آدرس و پورت سرور HTTP |
| `MONGO_URI` | `mongodb://localhost:27017` | رشته اتصال MongoDB (در Compose: `mongodb://mongo:27017`) |
| `MONGO_DB` | `pharmastock` | نام پایگاه داده MongoDB |
| `JWT_SECRET` | `dev-only-change-me` | کلید امضای توکن JWT (در محیط تولید حتماً تغییر دهید) |
| `JWT_TTL_HOURS` | `12` | مدت اعتبار توکن به ساعت |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3001` | مبدأهای مجاز CORS (با کاما جدا شده) |
| `DEMO_PASSWORD` | `change-me-demo-only` | رمز عبور کاربران دمو هنگام اجرای Seed |
| `SEED_ON_START` | `false` | در صورت `true` بودن، هنگام بالا آمدن سرویس Seed اجرا می‌شود |
| `TTAC_BASE_URL` | `https://newapi.ttac.ir` | آدرس پایه سرویس تی‌تک |
| `TTAC_TIMEOUT_MS` | `5000` | تایم‌اوت درخواست‌های TTAC (میلی‌ثانیه) |
| `TTAC_ENABLED` | `true` | فعال/غیرفعال‌کردن فراخوانی خارجی TTAC (در حالت `false` فقط از کش استفاده می‌شود) |

### فرانت‌اند (`frontend/.env.example`)
| متغیر | مقدار پیش‌فرض | توضیح |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | آدرس پایه بک‌اند Go |

---

## ۸. راهنمای اجرا و تست

### روش ۱: اجرای سریع توسعه (MongoDB با Docker + Go و Next.js محلی)
```bash
# ۱. راه‌اندازی MongoDB
cd backend
docker compose up -d mongo

# ۲. بیلد و اجرای بک‌اند به همراه Seed اولیه
make build
SEED_ON_START=true DEMO_PASSWORD=change-me-demo-only ./bin/api
# یا مستقیم: make run

# ۳. در ترمینال جدید: اجرای فرانت‌اند
cd ../frontend
cp -n .env.example .env.local
pnpm install
pnpm dev
```
پس از اجرا:
- فرانت‌اند: `http://localhost:3000`
- بک‌اند و بررسی سلامت: `http://localhost:8080/healthz`

### روش ۲: اجرای کامل بک‌اند با Docker Compose
```bash
cd backend
make up        # docker compose up --build -d (MongoDB :27017 + API :8080)
# توقف سرویس‌ها:
make down
```

### اجرای تست‌ها و بررسی کیفیت کد

**تست‌های بک‌اند (Go):**
```bash
cd backend
make test      # معادل go test ./...
```

**بررسی‌ها و تست‌های فرانت‌اند:**
```bash
cd frontend
pnpm lint       # بررسی ESLint
pnpm typecheck  # بررسی تایپ‌های TypeScript (tsc --noEmit)
pnpm test       # تست‌های واحد با Vitest
```

**تست‌های E2E با Playwright:**
پیکربندی `frontend/playwright.config.ts` یک سرور تولیدی Next.js را روی `http://127.0.0.1:3001` بالا می‌آورد؛ بنابراین پیش از اجرای آن، فرانت‌اند باید بیلد شده باشد و بک‌اند + MongoDB در حال اجرا باشند:
```bash
# بک‌اند با داده‌های دمو و غیرفعال‌سازی شبکه TTAC برای تست قطعی:
cd backend
TTAC_ENABLED=false SEED_ON_START=true DEMO_PASSWORD=change-me-demo-only ./bin/api

# در ترمینال دیگر:
cd frontend
pnpm build
pnpm test:e2e
```
