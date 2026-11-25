# Design Tokens & Icon System — انبار دارو · PharmaStock

This document defines the canonical, centralized design token system and Material Symbols Outlined icon mapping for **PharmaStock**, reconciling conflicts discovered across the exported Stitch reference (`docs/stitch-reference/DESIGN.md`, `docs/stitch-reference/screens/design-system-spec/screen.md`, `docs/stitch-reference/EXTRACTED.md`, and the 17 generated `screen.html` files).

---

## 1. Architecture & Layering

Tokens are structured in three strict layers with **light-only** values and **no dark-mode rules**:

1. **Primitive Tokens (`src/tokens/primitives.ts`, `src/styles/tokens.css` `--ps-p-*`):** Raw, immutable palette scales (Slate, Clinical Teal, Emerald, Amber, Orange, Rose, Sky), alpha stops, font stacks, 8px-grid spacing scale, radii, elevation shadows, and layout constants.
2. **Semantic Tokens (`src/tokens/semantic.ts`, `src/styles/tokens.css` `--ps-*`):** Purpose-bound roles (`background`, `surface`, `text`, `border`, `primary`, `focus`, `status`, `radius`, `elevation`, `layout`) scoped to `:root, [data-theme="clinical-light"]` with `color-scheme: light`.
3. **Tailwind v4 `@theme inline` & shadcn/ui Bridge (`src/app/globals.css`, `src/styles/tokens.css`):** Maps semantic `--ps-*` custom properties to Tailwind v4 theme keys (`--color-*`, `--text-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--breakpoint-*`) and shadcn/ui variables (`--background`, `--foreground`, `--primary`, `--border`, `--ring`, `--radius`).

### Future-Theme Readiness (Without Dark-Mode Values)
- `src/tokens/themes.ts` registers themes via `themes` (`ThemeId`, `getThemeTokens()`) and `RootLayout` stamps `data-theme={DEFAULT_THEME_ID}` (`"clinical-light"`) on `<html>`.
- Adding a future theme requires only adding a `[data-theme="<id>"]` CSS block overriding `--ps-*` variables and a matching `ThemeTokens` entry in `src/tokens/themes.ts`.
- **Constraint enforced:** Zero `.dark` selectors, zero `prefers-color-scheme: dark` media queries, and zero dark-mode hex values exist anywhere in the token system.

---

## 2. Canonical Color Mapping

### 2.1 Core Surface, Text, Border & Brand Colors

| Semantic Role | CSS Variable | Tailwind v4 Utility | Canonical Value | Reason for Canonical Choice |
| --- | --- | --- | --- | --- |
| Page Canvas | `--ps-bg` | `bg-background` | `#f8fafc` (Slate 50) | Matches `DESIGN.md` prose, `design-system-spec/screen.md`, and `components.json` (`baseColor: slate`) for a modern minimal clinical canvas without glare. |
| Floating Shell Canvas | `--ps-bg-shell` + `--ps-bg-shell-pattern` | `bg-shell` | Mild slate→teal-tint `linear-gradient` + low-alpha dot `radial-gradient` (18px grid) | Floating AppShell backdrop: atmosphere without competing with white islands; pattern stays borderline-invisible for dense clinical work. |
| Card / Panel / Table Surface | `--ps-surface` | `bg-surface` / `bg-card` | `#ffffff` | Identical across `DESIGN.md` prose, `screen.md`, and `surface-container-lowest` in all 17 HTML screens. Framing for cards **and** data tables is **soft border only** (`border-border-default` / `#E2E8F0`) — never a drop shadow (`shadow-none` / level-1). Sticky table headers add a soft bottom rule (`border-border-strong`), not inset shadow. |
| Subtle Surface / Divider BG | `--ps-surface-subtle` | `bg-surface-subtle` | `#f1f5f9` (Slate 100) | Matches `screen.md` (`#F1F5F9`), replacing M3 multi-step greenish-gray containers (`#f2f4f6`–`#e0e3e5`) with a clean minimal neutral ramp. |
| Interactive Hover Surface | `--ps-surface-hover` | `bg-surface-hover` | `#f0fdfa` (Teal 50) | Matches `DESIGN.md` prose (`Primary Surface Tint`) and `screen.md` (`Primary Teal Light`) for table row hover and active filters. |
| Primary Text | `--ps-text` | `text-text-primary` | `#0f172a` (Slate 900) | Matches `DESIGN.md` prose & `screen.md`; crisp 17.7:1 contrast on `#ffffff` and pairs cleanly with Slate borders. |
| Secondary Text | `--ps-text-secondary` | `text-text-secondary` | `#475569` (Slate 600) | Matches `DESIGN.md` prose & `screen.md`; strong ~7.5:1 contrast for table headers, timestamps, and metadata. |
| Muted Readable Text | `--ps-text-muted` | `text-text-muted` | `#64748b` (Slate 500) | Selected over `#94a3b8` for readable captions/sub-labels to preserve WCAG AA (>= 4.5:1) contrast on `#ffffff`. |
| Placeholder / Disabled | `--ps-text-placeholder` | `text-text-placeholder` | `#94a3b8` (Slate 400) | Preserves `DESIGN.md` prose & `screen.md` `Text Muted` specifically for placeholders, structural icons, and disabled states. |
| Default Structural Border | `--ps-border` | `border-border-default` | `#e2e8f0` (Slate 200) | Matches `DESIGN.md` prose, `screen.md`, and Phase A `globals.css` for crisp 1px clinical framing without drop shadows. |
| Subtle Divider Border | `--ps-border-subtle` | `border-border-subtle` | `#f1f5f9` (Slate 100) | Matches `screen.md` `Border Muted / Dividers` for lightweight row/section hairlines. |
| Strong Border | `--ps-border-strong` | `border-border-strong` | `#cbd5e1` (Slate 300) | Matches `DESIGN.md` prose (`#CBD5E1`) for hover borders, sticky header bottom rules, checkboxes, and Level 3 dialog borders. |
| Primary Brand / Action | `--ps-primary` | `bg-primary` / `text-primary` | `#0f766e` (Teal 700) | Unifies `DESIGN.md` prose, `screen.md`, Phase A `globals.css`, and all 17 HTML screens (which already styled primary buttons/active nav via `primary-container: #0f766e`). |
| Primary Hover | `--ps-primary-hover` | `bg-primary-hover` | `#115e59` (Teal 800) | Matches `DESIGN.md` prose & `screen.md` hover state for `#0F766E`. |
| Primary Active / Deep | `--ps-primary-active` | `bg-primary-active` | `#005c55` | Preserves M3 `primary` (`#005c55`) from Stitch HTML config as the pressed/deep teal accent. |
| Primary Surface Tint | `--ps-primary-tint` | `bg-primary-tint` | `#f0fdfa` (Teal 50) | Matches `DESIGN.md` prose & `screen.md`. |
| Primary Subtle Border | `--ps-primary-border` | `border-primary-border` | `#99f6e4` (Teal 200) | Matches `screen.md` `Primary Teal Border`. |
| Secondary Supporting Teal | `--ps-secondary` | `bg-secondary` | `#216963` | Preserved from Stitch M3 `secondary` for secondary clinical controls. |
| Focus Ring & Border | `--ps-focus-border` / `--ps-focus-ring` | `ps-focus-ring` / `shadow-focus` | `#0f766e` + `rgba(15, 118, 110, 0.12)` (3px) | Exact specification from `DESIGN.md` Input Fields (`3px outer glow ring of rgba(15, 118, 110, 0.12)`). |

### 2.2 Preserved Stitch Inventory Status Colors

All four Stitch pharmaceutical inventory triage statuses are preserved **verbatim** from `DESIGN.md` prose, `design-system-spec/screen.md`, and HTML badge occurrences, plus two completing semantic utility tones (`info`, `neutral`):

| Status Tier (Persian Label) | Foreground (`--ps-status-*-fg`) | Background (`--ps-status-*-bg`) | Border (`--ps-status-*-border`) | Source |
| --- | --- | --- | --- | --- |
| **موجود و معتبر** (`valid`) | `#059669` | `#ecfdf5` | `#a7f3d0` | Preserved verbatim (`DESIGN.md` + `screen.md` + HTML) |
| **روبه‌اتمام** (`warning`) | `#d97706` | `#fffbeb` | `#fde68a` | Preserved verbatim (`DESIGN.md` + `screen.md` + HTML) |
| **نزدیک به انقضا** (`expiring`) | `#ea580c` | `#fff7ed` | `#ffedd5` | Preserved verbatim (`DESIGN.md` + `screen.md` + HTML) |
| **منقضی یا ناموجود** (`critical`) | `#e11d48` | `#fff1f2` | `#fecdd3` | Preserved verbatim (`DESIGN.md` + `screen.md` + HTML `rose-*`) |
| **اطلاع‌رسانی / در مسیر** (`info`) | `#0284c7` | `#eff6ff` | `#bfdbfe` | Consolidates ad-hoc `blue-50`/`blue-700` HTML badges |
| **خنثی / آرشیو** (`neutral`) | `#475569` | `#f1f5f9` | `#e2e8f0` | Standardized neutral badge using Slate scale |

---

## 3. Original Stitch Values, Conflicts & Resolution Rationale

| Category | Original Stitch Values (Source A: M3 YAML & 17 `screen.html` configs) | Conflicting Stitch Values (Source B: `DESIGN.md` Prose, `screen.md`, HTML Bodies) | Canonical Choice & Reason |
| --- | --- | --- | --- |
| **Primary & Error Colors** | `primary: #005c55`, `primary-container: #0f766e`, `error: #ba1a1a`, `error-container: #ffdad6` | `DESIGN.md` prose & `screen.md`: `Primary: #0F766E`, `Hover: #115E59`, `Critical/Error: #E11D48` (`#FFF1F2` / `#FECDD3`); HTML buttons use `bg-primary-container` (`#0f766e`) and `rose-*` badges | **Canonical `#0F766E` primary / `#115E59` hover / `#E11D48` critical.** HTML screens already used `#0f766e` for primary actions; unifying on `#0F766E` and `#E11D48` eliminates the dual M3-vs-Tailwind palette split while preserving `#005c55` as `primary-active`. |
| **Neutrals & Surfaces** | `background/surface: #f7f9fb`, 5 surface container steps (`#ffffff` to `#e0e3e5`), `on-surface: #191c1e`, `on-surface-variant: #3e4947`, `outline: #6e7977`, `outline-variant: #bdc9c6` | `DESIGN.md` prose & `screen.md`: `#F8FAFC` canvas, `#FFFFFF` card, `#F1F5F9` divider, `#E2E8F0` border, `#CBD5E1` strong border, `#0F172A` / `#475569` / `#94A3B8` text; Phase A used `#f7f9fb` + `#e2e8f0` | **Canonical Slate neutral ramp (`#F8FAFC`, `#FFFFFF`, `#F1F5F9`, `#E2E8F0`, `#CBD5E1`, `#0F172A`, `#475569`, `#64748B`, `#94A3B8`).** Matches the modern/minimal direction, `components.json` (`slate`), and `screen.md`, avoiding warm/green-tinted M3 gray clashes with `#E2E8F0`. |
| **Font Families** | `dashboard` & `login` configs set `["Inter"]` only; 3 screens set `["Vazirmatn", "sans-serif"]`; 12 screens set `["Vazirmatn", "Inter"]` | `screen.md` specifies `Vazirmatn` exclusively; `DESIGN.md` prose recommends Vazirmatn primary with Inter for Latin/codes | **Canonical `--font-sans`: `"Vazirmatn Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif`** + `--font-latin` (`Inter Variable`) + `.tabular-nums-data` (`font-variant-numeric: tabular-nums`). Both fonts are self-hosted locally via `@fontsource-variable/*`. |
| **Typography Scale** | M3 12-role scale (`headline-xl: 2rem` down to `label-sm: 0.6875rem`, `body-md: 14px/24px`) | `screen.md` 7-step scale (`H1: 24/36`, `H2: 18/28`, `H3: 15/24`, `Body Lg: 14/22`, `Body Reg: 13/20`, `Caption: 11-12/16`, `KPI: 28/34`) + arbitrary `text-[13px]`/`text-[28px]` in HTML | **Unified 14-role canonical scale** keeping `headline-xl` (`32px`) & `headline-lg` (`24px/36px`) while integrating `title-sm` (`15px/24px`), `body-md` (`14px/22px`), `body-sm` (`13px/20px`), `kpi` (`28px/34px`), and `data-tabular` (`14px/20px`). |
| **Border Radii** | HTML Tailwind config: `DEFAULT: 4px`, `lg: 8px`, `xl: 12px`, `full: 9999px` | `DESIGN.md` YAML: `sm: 4px`, `DEFAULT: 8px`, `md: 12px`, `lg: 16px`, `xl: 24px`. `DESIGN.md` prose: base `8–10px`, dialogs `16px`, inner `6px`, checkbox `4px`. `screen.md`: `10px` default, `9999px` badges. HTML bodies: `rounded-xl` (562x) & `rounded-[10px]` (211x). | **Canonical semantic radii:** `default: 10px`, `badge: 9999px`, `checkbox: 4px`, `inner: 6px`, `md: 8px`, `lg: 12px`, `dialog: 16px`, **`panel: 16px`** (floating shell islands). Directly satisfies `screen.md` (`10px` default, `full` badges) and `DESIGN.md` prose (`4px` checkboxes, `16px` dialogs). |
| **Elevation & Borders** | HTML bodies omit borders on many cards and apply `shadow-sm` (224x) or `shadow-[0_1px_8px_rgba(0,0,0,0.04)]` (32x) | `DESIGN.md` prose & `screen.md`: Level 1 cards use `1px solid #E2E8F0` with **no drop shadow**; Level 2 dropdowns use `0 4px 12px rgba(15,23,42,0.05)`; Level 3 dialogs use `0 12px 32px rgba(15,23,42,0.12)` | **Restrained soft-border elevation for cards & tables:** Level 1 = soft `1px` `border-border-default` (`#E2E8F0`) + **zero** drop shadow (`level-1` / `shadow-card` / Tailwind `shadow-sm` all resolve to `none`). Data table containers (`Table`, `DenseDataTable`) share the same soft-border frame. Sticky table headers use Level 1 + a soft bottom rule (`border-b-2 border-border-strong` / `#CBD5E1`) — never inset/drop shadow. Level 2/3 keep ambient/diffuse shadows only for floating overlays (dropdown / dialog). Shell hairline remains optional chrome, not card/table framing. |
| **Spacing** | Custom tokens (`space-xs: 4px`, `space-sm: 8px`, `space-md: 16px`, `space-lg: 24px`, `space-xl: 32px`, `gutter: 16px`, `gutter-lg: 24px`) | HTML mixes token classes with Tailwind numeric utilities including `10px`/`12px` (`py-2.5`, `gap-3`) | **8px-grid primitive scale + Stitch semantic aliases** (`space-xs`..`space-xl`, `gutter`, `gutter-lg`, `margin`, `margin-mobile`) plus `cell-y: 10px` / `cell-x: 16px` for dense clinical tables per `DESIGN.md`. |
| **Layout Shell** | `w-[260px]` sidebar on 15 screens vs `w-64` (`256px`) on `dashboard`; header `h-16` (`64px`) on all 16 dashboard screens | `DESIGN.md` prose: `260px` expanded / `72px` collapsed sidebar, `64px` header, `768px` tablet & `1280px` desktop breakpoints; `screen.md` adds `480–560px` drawer & `420px` confirm dialog | **Canonical layout tokens:** `sidebarWidth: 260px`, `sidebarCollapsedWidth: 72px`, `headerHeight: 64px`, `drawerWidth: 560px`, `confirmDialogWidth: 420px`, **floating shell** `shellInset: 16px` / `shellInsetMobile: 12px` / `shellGap: 16px`, breakpoints `tablet: 768px` (`48rem`) and `desktop: 1280px` (`80rem`). Floating islands use border-only framing (no island drop shadow). |
| **Dark Mode Config** | `darkMode: "class"` in all 17 HTML `tailwind.config` blocks | Zero `dark:` classes across all 17 screens | **Light-only (`color-scheme: light`).** Theme architecture supports future themes via `data-theme`, with zero dark-mode values defined. |

---

## 4. Material Symbols Icon Mapping Utility

- **Local Font Assets:** `material-symbols` (`0.48.3`) imported locally in `src/app/layout.tsx` via `import 'material-symbols/outlined.css'` (serving `material-symbols-outlined.woff2`, zero external CDN requests).
- **Registry & Component:**
  - `src/lib/icons/registry.ts` (`STITCH_ICON_MAP`, `DIRECT_STITCH_ICONS`, `MISSING_STITCH_ICON_MAPPINGS`, `STATUS_ICON_MAP`, `resolveIcon()`)
  - `src/components/ui/icon.tsx` (`<Icon name="..." size={20} filled={false} />`)
- **Coverage:** All **214** unique Stitch icon names recorded in `EXTRACTED.md` are preserved as valid `StitchIconName` keys:
  - **202** names map 1:1 to `MaterialSymbol` ligatures in `material-symbols@0.48.3`.
  - **12** legacy Material Icons names missing from `material-symbols@0.48.3` are mapped to verified Material Symbols Outlined equivalents:

| Original Stitch Name | Mapped Material Symbol | Variation | Screens Using It | Reason |
| --- | --- | --- | --- | --- |
| `access_time_filled` | `schedule` | `FILL=1` | `dashboard` | Legacy Material Icons filled clock variant; replaced by `schedule` with `FILL=1`. |
| `announcement` | `campaign` | `FILL=0` | `dashboard-inventory` | Legacy warning/alert banner icon; `campaign` is the Material Symbols equivalent. |
| `auto_awesome` | `wand_stars` | `FILL=0` | `auto-reorder-suggestions` | Legacy sparkle/AI suggestion icon; replaced by `wand_stars`. |
| `auto_fix_high` | `wand_shine` | `FILL=0` | `drug-catalog` | Legacy magic-wand auto-fill icon; replaced by `wand_shine`. |
| `do_not_disturb` | `do_not_disturb_on` | `FILL=0` | `dashboard-inventory` | Un-suffixed name removed in Material Symbols; replaced by `do_not_disturb_on`. |
| `done` | `check` | `FILL=0` | `drug-details-cardex`, `periodic-stocktake` | Legacy checkmark alias; Material Symbols standardizes on `check`. |
| `expand_less` | `keyboard_arrow_up` | `FILL=0` | `distributor-returns` | Legacy chevron alias; replaced by `keyboard_arrow_up`. |
| `expand_more` | `keyboard_arrow_down` | `FILL=0` | All shell headers & selects (36x) | Legacy chevron alias; replaced by `keyboard_arrow_down`. |
| `file_download` | `download` | `FILL=0` | `audit-log`, `dashboard`, `drug-catalog` | Legacy download alias; Material Symbols standardizes on `download`. |
| `help_outline` | `help` | `FILL=0` | `drug-details-cardex` | Legacy outlined suffix removed; `help` is outlined by default. |
| `new_releases` | `release_alert` | `FILL=0` | `purchase-invoice-reconciliation` | Replaced by `release_alert` for unmapped/new item alert badges. |
| `send_to_mobile` | `mobile_share` | `FILL=0` | `dashboard-inventory` | Legacy mobile transfer icon; replaced by `mobile_share` for quick dispense action. |

---

## 5. DatePicker (shadcn Calendar + Popover)

- **Primitives:** `src/components/ui/calendar.tsx` (`react-day-picker` v10), `src/components/ui/popover.tsx` (Radix via `radix-ui` package).
- **Field:** `src/components/ui/date-picker.tsx` — value/`onChange` are ISO `YYYY-MM-DD`; trigger label uses `formatJalaliDate` (Persian digits).
- **Icons:** Material Symbols only (`calendar_month`, `chevron_left` / `chevron_right` / `expand_more`) — no `lucide-react`.
- **Tokens:** Surfaces/borders/focus use PharmaStock semantic classes (`bg-surface`, `border-border-default`, `bg-primary`, `shadow-focus`, …).
- **Gallery:** `/components` → بخش ورودی‌ها.
