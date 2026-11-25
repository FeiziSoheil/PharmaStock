# انبار دارو · PharmaStock

سامانه جامع مدیریت موجودی، انبارداری و کنترل فرآیندهای داروخانه با پشتیبانی کامل از زبان فارسی (`RTL`)، تاریخ جلالی، استعلام تی‌تک (TTAC)، منطق خروج **FEFO**، کاردکس دارو، دفترچه داروهای تحت کنترل و لاگ ممیزی تغییرناپذیر.

> برای مطالعه مستندات فنی کامل، لیست اندپوینت‌ها، مدل پایگاه داده و ماتریس دسترسی‌ها به [مستند جامع پروژه](docs/DOCUMENTATION.md) مراجعه کنید.

---

## امکانات اصلی

- **پیشخوان و موجودی لحظه‌ای:** پایش شاخص‌های انبار، ورود سریع کالا و تغییر وضعیت گروهی (`/dashboard`، `/dashboard-inventory`).
- **کاتالوگ دارو و TTAC:** مدیریت اقلام دارویی با کد ژنریک و GTIN، استعلام و جستجوی TTAC و کاردکس گردش کالا (`/drug-catalog`، `/drug-details-cardex`).
- **انبارداری قفسه‌ای و هشدار انقضا (FEFO):** مدیریت جایگاه‌ها و چاپ برچسب قفسه (`/shelf-inventory`) و پایش دسته‌های نزدیک به انقضا (`/expiry-alerts-fefo`).
- **عملیات ورود، خروج و مرجوعی:** ثبت رسید فاکتور خرید (`/invoice-receipts`)، تطبیق فاکتور اکسل (`/purchase-invoice-reconciliation`)، حواله خروج بر اساس FEFO (`/dispensing-dispatch`)، انتقال داخلی (`/internal-transfer`) و مرجوعی به پخش (`/distributor-returns`).
- **کنترل کیفیت و انطباق قانونی:** پیشنهاد سفارش خودکار و PO (`/auto-reorder-suggestions`)، انبارگردانی دوره‌ای (`/periodic-stocktake`)، دفترچه داروهای تحت کنترل/مخدر (`/controlled-substances-ledger`) و لاگ ممیزی (`/audit-log`).
- **امنیت و تفکیک وظایف (RBAC):** مدیریت کاربران و ماتریس دسترسی با قفل‌های قانونی برای داروساز مسئول فنی (`/users-permissions`).

---

## پشته فناوری

- **Backend:** Go `1.23` · Echo v4 · MongoDB `7` · JWT · bcrypt
- **Frontend:** Next.js `16` (App Router) · React `19` · TypeScript · Tailwind CSS v4 · Radix UI
- **Testing:** `go test` · Vitest · Testing Library · Playwright

---

## ساختار پروژه

```text
PharmaStock/
├── backend/    # سرویس Go API، اسکریپت Seed و docker-compose.yml
├── frontend/   # اپلیکیشن Next.js (RTL) و تست‌های Vitest / Playwright
└── docs/       # مستندات فنی، قرارداد API و راهنمای سیستم طراحی
```

---

## پیش‌نیازها

- **Docker** و **Docker Compose** (برای MongoDB یا اجرای کانتینری بک‌اند)
- **Go 1.23+** (برای اجرا و تست محلی بک‌اند)
- **Node.js** و **pnpm** (برای فرانت‌اند)

---

## راه‌اندازی سریع (توسعه محلی)

### ۱. راه‌اندازی پایگاه داده و بک‌اند

```bash
cd backend
docker compose up -d mongo
make build
SEED_ON_START=true DEMO_PASSWORD=change-me-demo-only ./bin/api
```

> یا اجرای یک‌جای MongoDB و API با داکر: `cd backend && make up`

سرویس API روی `http://localhost:8080` اجرا می‌شود و از طریق `GET /healthz` قابل بررسی است.

### ۲. راه‌اندازی فرانت‌اند

```bash
cd frontend
cp -n .env.example .env.local
pnpm install
pnpm dev
```

رابط کاربری روی `http://localhost:3000` در دسترس خواهد بود.

### ۳. اطلاعات ورود دمو

پس از اجرای Seed اولیه (`SEED_ON_START=true` یا `make seed`) می‌توانید با حساب پیش‌فرض وارد شوید:

- **نام کاربری:** `operator`
- **رمز عبور:** `change-me-demo-only` (قابل تنظیم با `DEMO_PASSWORD`)
- **شعبه:** `branch-central`

> حساب‌های دیگر (`dr.rezaei` مسئول فنی، `m.kazemi` انباردار، `e.yazdani` متصدی نسخه و `a.hosseini` مدیر سامانه) نیز در `backend/internal/seed/seed.go` تعریف شده‌اند.

---

## تست و بررسی کیفیت

```bash
# تست‌های بک‌اند
cd backend && make test

# تست‌های واحد، تایپ‌چک و لینت فرانت‌اند
cd frontend && pnpm lint && pnpm typecheck && pnpm test

# تست‌های E2E (نیازمند اجرای بک‌اند/MongoDB و بیلد فرانت‌اند)
cd frontend && pnpm build && pnpm test:e2e
```

---

## مستندات تکمیلی

- [مستند جامع سامانه (معماری، API، RBAC، پایگاه داده)](docs/DOCUMENTATION.md)
- [راهنمای بک‌اند](backend/README.md)
- [اتصال فرانت‌اند به بک‌اند Go](docs/backend/FRONTEND-WIREUP.md)
- [قرارداد صفحات و APIها](docs/backend/PAGES-FOR-BACKEND-PROMPTS.md)
- [توکن‌های طراحی](docs/design-tokens.md)
