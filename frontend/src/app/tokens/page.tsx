import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import {
  MISSING_STITCH_ICON_MAPPINGS,
  STATUS_ICON_MAP,
  type LegacyStitchIconName,
  type MissingIconMapping,
} from '@/lib/icons'
import { clinicalLightTokens } from '@/tokens'

const CORE_SWATCHES = [
  {
    name: 'پس‌زمینه صفحه (Background)',
    token: '--ps-bg',
    hex: clinicalLightTokens.colors.background,
    className: 'bg-background',
  },
  {
    name: 'سطح کارت (Surface)',
    token: '--ps-surface',
    hex: clinicalLightTokens.colors.surface,
    className: 'bg-surface',
  },
  {
    name: 'سطح ملایم (Surface Subtle)',
    token: '--ps-surface-subtle',
    hex: clinicalLightTokens.colors.surfaceSubtle,
    className: 'bg-surface-subtle',
  },
  {
    name: 'رنگ اصلی (Primary)',
    token: '--ps-primary',
    hex: clinicalLightTokens.colors.primary.default,
    className: 'bg-primary',
  },
  {
    name: 'هاور اصلی (Primary Hover)',
    token: '--ps-primary-hover',
    hex: clinicalLightTokens.colors.primary.hover,
    className: 'bg-primary-hover',
  },
  {
    name: 'تینت اصلی (Primary Tint)',
    token: '--ps-primary-tint',
    hex: clinicalLightTokens.colors.primary.tint,
    className: 'bg-primary-tint',
  },
  {
    name: 'حاشیه استاندارد (Border)',
    token: '--ps-border',
    hex: clinicalLightTokens.colors.border.default,
    className: 'bg-border-default',
  },
  {
    name: 'متن اصلی (Text Primary)',
    token: '--ps-text',
    hex: clinicalLightTokens.colors.text.primary,
    className: 'bg-text-primary',
  },
] as const

const INVENTORY_STATUSES = [
  {
    key: 'valid',
    label: 'موجود و معتبر',
    icon: STATUS_ICON_MAP.valid,
    badgeClass: 'bg-status-valid-bg text-status-valid-fg border-status-valid-border',
    hex: clinicalLightTokens.colors.status.valid,
  },
  {
    key: 'warning',
    label: 'روبه‌اتمام',
    icon: STATUS_ICON_MAP.warning,
    badgeClass: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border',
    hex: clinicalLightTokens.colors.status.warning,
  },
  {
    key: 'expiring',
    label: 'نزدیک به انقضا',
    icon: STATUS_ICON_MAP.expiring,
    badgeClass: 'bg-status-expiring-bg text-status-expiring-fg border-status-expiring-border',
    hex: clinicalLightTokens.colors.status.expiring,
  },
  {
    key: 'critical',
    label: 'منقضی یا ناموجود',
    icon: STATUS_ICON_MAP.critical,
    badgeClass: 'bg-status-critical-bg text-status-critical-fg border-status-critical-border',
    hex: clinicalLightTokens.colors.status.critical,
  },
] as const

const RADIUS_SAMPLES = [
  { label: 'چک‌باکس (4px)', token: '--ps-radius-checkbox', className: 'rounded-checkbox' },
  { label: 'بج داخلی (6px)', token: '--ps-radius-inner', className: 'rounded-inner' },
  { label: 'کنترل فشرده (8px)', token: '--ps-radius-md', className: 'rounded-md' },
  { label: 'پیش‌فرض کارت/دکمه (10px)', token: '--ps-radius-default', className: 'rounded-default' },
  { label: 'دیالوگ و مودال (16px)', token: '--ps-radius-dialog', className: 'rounded-dialog' },
  { label: 'بج وضعیت (full)', token: '--ps-radius-badge', className: 'rounded-badge' },
] as const

const SPACING_SAMPLES = [
  { label: 'xs (4px)', varName: '--ps-space-xs', barClass: 'w-space-xs' },
  { label: 'sm (8px)', varName: '--ps-space-sm', barClass: 'w-space-sm' },
  { label: 'md / gutter (16px)', varName: '--ps-space-md', barClass: 'w-space-md' },
  { label: 'lg / gutter-lg (24px)', varName: '--ps-space-lg', barClass: 'w-space-lg' },
  { label: 'xl (32px)', varName: '--ps-space-xl', barClass: 'w-space-xl' },
] as const

const FEATURED_NATIVE_ICONS = [
  'local_pharmacy',
  'medication',
  'vaccines',
  'inventory_2',
  'shelves',
  'receipt_long',
  'qr_code_scanner',
  'thermostat',
  'ac_unit',
  'verified_user',
  'swap_horiz',
  'notifications',
] as const

export default function TokensPreviewPage() {
  const legacyMappings = Object.entries(MISSING_STITCH_ICON_MAPPINGS) as [
    LegacyStitchIconName,
    MissingIconMapping,
  ][]

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-default border border-border-default bg-surface px-6 py-5">
        <div>
          <p className="text-label-md text-primary">فاز B · سیستم متمرکز توکن‌های طراحی</p>
          <h1 className="mt-1 text-headline-lg text-text-primary">
            پیش‌نمایش توکن‌ها و آیکون‌های انبار دارو ·{' '}
            <span className="font-latin" dir="ltr">
              PharmaStock Design Tokens
            </span>
          </h1>
        </div>
        <Link
          href="/"
          className="ps-focus-ring inline-flex h-10 items-center gap-2 rounded-default border border-border-default bg-surface px-4 text-label-lg text-text-primary transition-colors hover:bg-surface-subtle"
        >
          <Icon name="arrow_forward" size={18} />
          <span>بازگشت به صفحه اصلی</span>
        </Link>
      </header>

      {/* Core Palette */}
      <section
        aria-labelledby="section-colors"
        className="rounded-default border border-border-default bg-surface p-6"
      >
        <h2 id="section-colors" className="text-headline-sm text-text-primary">
          پالت کانونیکال و سطوح (تم روشن بالینی)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
          {CORE_SWATCHES.map((item) => (
            <div
              key={item.token}
              data-token-swatch={item.token}
              className="flex items-center gap-3 rounded-default border border-border-default bg-surface p-3"
            >
              <div
                className={`h-10 w-10 shrink-0 rounded-inner border border-border-default ${item.className}`}
              />
              <div className="min-w-0">
                <div className="truncate text-label-lg text-text-primary">{item.name}</div>
                <div className="font-latin text-label-md text-text-secondary" dir="ltr">
                  {item.token} · {item.hex}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preserved Stitch Inventory Statuses */}
      <section
        aria-labelledby="section-status"
        className="rounded-default border border-border-default bg-surface p-6"
      >
        <h2 id="section-status" className="text-headline-sm text-text-primary">
          رنگ‌های وضعیت موجودی و انقضای کالا (حفظ‌شده از Stitch)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
          {INVENTORY_STATUSES.map((status) => (
            <div
              key={status.key}
              data-status-card={status.key}
              className="rounded-default border border-border-default bg-surface p-4"
            >
              <span
                data-status-badge={status.key}
                className={`inline-flex items-center gap-1.5 rounded-badge border px-2.5 py-1 text-label-md ${status.badgeClass}`}
              >
                <Icon name={status.icon} size={14} />
                <span>{status.label}</span>
              </span>
              <dl className="mt-3 space-y-1 font-latin text-label-md text-text-secondary" dir="ltr">
                <div>fg: {status.hex.foreground}</div>
                <div>bg: {status.hex.background}</div>
                <div>border: {status.hex.border}</div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* Typography & Tabular Numerals */}
      <section
        aria-labelledby="section-typography"
        className="rounded-default border border-border-default bg-surface p-6"
      >
        <h2 id="section-typography" className="text-headline-sm text-text-primary">
          تایپوگرافی و ارقام جدولی (Vazirmatn + Inter)
        </h2>
        <div className="mt-4 space-y-3 divide-y divide-border-subtle">
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
            <span className="text-headline-lg text-text-primary">تیتر صفحه اصلی (Headline LG)</span>
            <span className="font-latin text-label-md text-text-secondary" dir="ltr">
              24px / 36px · 700
            </span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
            <span className="text-kpi tabular-nums-data text-text-primary">۱,۴۸۲ قلم فعال</span>
            <span className="font-latin text-label-md text-text-secondary" dir="ltr">
              KPI 28px / 34px · 700 · tabular-nums
            </span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 pt-3">
            <span className="text-data-tabular tabular-nums-data text-text-secondary">
              بچ <span className="font-latin" dir="ltr">B-403-99</span> · انقضا ۱۴۰۴/۰۶/۱۵ · قیمت{' '}
              <span className="font-latin" dir="ltr">245,000 IRR</span>
            </span>
            <span className="font-latin text-label-md text-text-secondary" dir="ltr">
              Data Tabular 14px / 20px · 500
            </span>
          </div>
        </div>
      </section>

      {/* Radii, Elevation & Spacing */}
      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <section
          aria-labelledby="section-radii"
          className="rounded-default border border-border-default bg-surface p-6"
        >
          <h2 id="section-radii" className="text-headline-sm text-text-primary">
            شعاع گوشه‌ها (Radius) و سایه‌ها (Elevation)
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {RADIUS_SAMPLES.map((r) => (
              <div
                key={r.token}
                data-radius-sample={r.token}
                className={`border border-border-strong bg-surface-subtle px-3 py-3 text-label-md text-text-primary ${r.className}`}
              >
                <div>{r.label}</div>
                <div className="mt-1 font-latin text-label-sm text-text-secondary" dir="ltr">
                  {r.token}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div
              data-elevation="level-1"
              className="rounded-default border border-border-default bg-surface p-3 shadow-none text-label-md"
            >
              سطح ۱ — بوردر نرم (بدون سایه)
            </div>
            <div
              data-elevation="level-2"
              className="rounded-default border border-border-default bg-surface p-3 shadow-dropdown text-label-md"
            >
              سطح ۲ (منو/دراپ‌داون)
            </div>
            <div
              data-elevation="level-3"
              className="rounded-dialog border border-border-strong bg-surface p-3 shadow-dialog text-label-md"
            >
              سطح ۳ (مودال ۱۶px)
            </div>
          </div>
        </section>

        <section
          aria-labelledby="section-layout-spacing"
          className="rounded-default border border-border-default bg-surface p-6"
        >
          <h2 id="section-layout-spacing" className="text-headline-sm text-text-primary">
            فاصله‌گذاری (8px Grid) و چیدمان پوسته
          </h2>
          <div className="mt-4 space-y-2.5">
            {SPACING_SAMPLES.map((s) => (
              <div key={s.varName} className="flex items-center justify-between gap-4">
                <span className="font-latin text-label-md text-text-secondary" dir="ltr">
                  {s.label}
                </span>
                <div className={`h-3 rounded-checkbox bg-primary ${s.barClass}`} />
              </div>
            ))}
          </div>
          <dl
            data-layout-tokens
            className="mt-5 grid grid-cols-2 gap-3 rounded-default border border-border-default bg-surface-subtle p-4 font-latin text-label-md text-text-secondary"
            dir="ltr"
          >
            <div>Sidebar Expanded: {clinicalLightTokens.layout.sidebarWidth}</div>
            <div>Sidebar Collapsed: {clinicalLightTokens.layout.sidebarCollapsedWidth}</div>
            <div>Header Height: {clinicalLightTokens.layout.headerHeight}</div>
            <div>
              Breakpoints: {clinicalLightTokens.layout.breakpoints.tablet} /{' '}
              {clinicalLightTokens.layout.breakpoints.desktop}
            </div>
          </dl>
        </section>
      </div>

      {/* Material Symbols Local Icons */}
      <section
        aria-labelledby="section-icons"
        className="rounded-default border border-border-default bg-surface p-6"
      >
        <h2 id="section-icons" className="text-headline-sm text-text-primary">
          مخزن متمرکز آیکون‌ها (Material Symbols Outlined محلی)
        </h2>
        <p className="mt-1 text-body-sm text-text-secondary">
          شامل ۲۰۲ آیکون مستقیم Stitch و ۱۲ نام قدیمیِ نگاشت‌شده به معادل رسمی Material Symbols.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {FEATURED_NATIVE_ICONS.map((name) => (
            <div
              key={name}
              data-icon-sample={name}
              className="inline-flex items-center gap-2 rounded-default border border-border-default bg-surface-subtle px-3 py-2 text-label-md text-text-primary"
            >
              <Icon name={name} size={20} className="text-primary" />
              <span className="font-latin" dir="ltr">
                {name}
              </span>
            </div>
          ))}
        </div>

        <h3 className="mt-6 text-title-sm text-text-primary">
          نگاشت نام‌های قدیمی Stitch (۱۲ مورد)
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-2 tablet:grid-cols-2 desktop:grid-cols-3">
          {legacyMappings.map(([stitchName, mapping]) => (
            <div
              key={stitchName}
              data-icon-legacy-sample={stitchName}
              className="flex items-center justify-between gap-2 rounded-default border border-border-default bg-surface px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Icon name={stitchName} size={20} className="text-primary" />
                <span className="font-latin text-label-md text-text-primary" dir="ltr">
                  {stitchName}
                </span>
              </div>
              <span className="font-latin text-label-sm text-text-secondary" dir="ltr">
                → {mapping.symbol}
                {mapping.filled ? ' (FILL=1)' : ''}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
