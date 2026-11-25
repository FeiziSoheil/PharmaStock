---
name: Clinical RTL Inventory
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3e4947'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#216963'
  on-secondary: '#ffffff'
  secondary-container: '#a8ece5'
  on-secondary-container: '#266d68'
  tertiary: '#005e40'
  on-tertiary: '#ffffff'
  tertiary-container: '#007954'
  on-tertiary-container: '#99ffce'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#abefe8'
  secondary-fixed-dim: '#8fd3cc'
  on-secondary-fixed: '#00201e'
  on-secondary-fixed-variant: '#00504b'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.875rem
  headline-sm:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.75rem
  title-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.625rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.25rem
  label-lg:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 0.875rem
  data-tabular:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a high-integrity, clinical aesthetic tailored specifically for pharmaceutical warehouse operations and high-density inventory administration in Iran. The target users are pharmacists, inventory controllers, and clinical warehouse managers who demand absolute clarity, zero perceptual friction, and error-proof data parsing under high-stress conditions.

The visual style combines **Corporate / Modern Precision** with **Clinical Healthcare Utilitarianism**:
- **Tone:** Calm, authoritative, exact, and dependable.
- **RTL-First Ergonomics:** Architected natively for Right-to-Left bidirectional layouts, with visual weight, optical hierarchy, and navigational flows anchored systematically from right to left.
- **Structural Integrity:** Emphasizes structural borders, crisp micro-lines, and subtle surface steps over expressive dropshadows or stylistic glass effects to eliminate ambiguity in dense tabular displays and expiration audits.

## Colors

The palette is engineered to balance sustained operational focus with instantaneous triage feedback. The primary clinical teal provides professional authority while avoiding visual fatigue during prolonged monitor exposure.

### Core Swatches
- **Primary (`#0F766E`):** Core interactive states, active navigation tabs, high-priority primary buttons, focused selection strokes.
- **Primary Hover / Deep Teal (`#115E59`):** Pressed and hover states for primary controls.
- **Primary Surface Tint (`#F0FDFA`):** Interactive element hover states, active table row tint, and selected filters.
- **Surface Canvas (`#F8FAFC`):** Application-wide shell background, neutralizing screen glare.
- **Surface Container (`#FFFFFF`):** Base panel, card, table body, and modal background.
- **Structural Border (`#E2E8F0`):** Standard 1px structural framing for tabular data, input containers, and structural dividers.

### Typography & Content Neutrals
- **Text Primary (`#0F172A`):** Drug names, Persian batch IDs, primary metrics, and table cell content.
- **Text Secondary (`#475569`):** Column labels, descriptions, Jalali calendar timestamps, and metadata.
- **Text Muted (`#94A3B8`):** Disabled states, structural icons, and secondary placeholders.

### Semantic Triage Tokens
Every semantic tier is strictly paired with an unambiguous Persian label and a supporting icon to prevent color-only diagnostic dependency:
- **Available & Valid (موجود و معتبر):** Fill `#059669`, Background `#ECFDF5`, Border `#A7F3D0`.
- **Low Stock Warning (روبه‌اتمام):** Fill `#D97706`, Background `#FFFBEB`, Border `#FDE68A`.
- **Expiring Soon (نزدیک به انقضا):** Fill `#EA580C`, Background `#FFF7ED`, Border `#FFEDD5`.
- **Critical / Expired / Out of Stock (منقضی یا ناموجود):** Fill `#E11D48`, Background `#FFF1F2`, Border `#FECDD3`.

## Typography

The typographic hierarchy is designed around dense clinical readability. While the system registers Inter as its base neutral foundation for international alphanumeric strings (batch codes, ATC codes, international nonproprietary names), font fallback stacks prioritize Vazirmatn in implementation to provide native Persian glyph shaping, proper baseline alignment, and unambiguous Persian numerals (۰-۹).

### Typography Principles
- **Numerical Regularity:** Numerical inventory values and stock counts utilize tabular, monospaced figures (`tnum`) to ensure aligned decimal separators across data columns.
- **Jalali Date Formatting:** Dates follow strict Persian formatting (e.g. `۱۴۰۳/۰۸/۱۵`) and are kept at `body-md` or `data-tabular` sizes to preserve horizontal scannability.
- **Line Heights:** Generous line heights are enforced across body and label roles to accommodate Persian diacritics and ascenders/descenders without clipping in dense layouts.

## Layout & Spacing

The layout is built on a desktop-first, strict 8px grid foundation tailored for widescreen operations, dispatch workstations, and point-of-dispense screens.

### Spatial Architecture
- **Right Sidebar (Navigation Panel):** Fixed width of 260px anchored to the right viewport boundary in RTL mode. Collapsible to 72px icon-only state for compact or dense-data views.
- **Top Header Bar:** 64px fixed height pinned to the top of the canvas, housing the active branch picker (`شعبه مرکزی`), global search input, contextual alerts, and user avatar.
- **Main Content Shell:** Fluid grid conforming to a 12-column dynamic layout using `gutter-lg` (24px) for dashboard widgets and KPI cards, reducing to `gutter` (16px) inside dense sub-panels.
- **Tabular Density:** Table cells follow a compressed vertical rhythm of 10px vertical padding (`space-xs` + 2px optical allowance) and 16px horizontal padding (`space-md`), balancing row packing with hit target safety.

### Breakpoints
- **Desktop (Primary):** `>= 1280px` (Full 12-column layout, persistent right sidebar, expanded tables).
- **Tablet / Small Display:** `768px – 1279px` (Sidebar collapses to icon bar, auxiliary columns hidden via column visibility toggles).
- **Mobile (Emergency Fallback):** `< 768px` (Single-column card flow, off-canvas navigation drawer, horizontal touch scrolling for data sheets).

## Elevation & Depth

To preserve clinical focus and reduce visual noise, this design system minimizes heavy dropped shadows. Depth is achieved via **low-contrast outlines, subtle neutral tone steps, and precise ambient contact shadows**.

### Elevation Scale
- **Level 0 (Flat Canvas):** `#F8FAFC`. Zero elevation, non-interactive shell foundation.
- **Level 1 (Card & Section Containers):** Surface `#FFFFFF` enclosed by a crisp 1px solid `#E2E8F0` border. No drop shadow.
- **Level 2 (Dropdowns, Branch Selectors & Sticky Table Headers):** Surface `#FFFFFF`, 1px solid `#E2E8F0`, with an ambient shadow: `0px 4px 12px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Modals, Overlays & Batch Edit Sheets):** Surface `#FFFFFF`, 1px solid `#CBD5E1`, with a clinical diffuse shadow: `0px 12px 32px rgba(15, 23, 42, 0.12)`.
- **Sticky Table Headers:** Utilize Level 1 with a bottom 2px rule `#CBD5E1` and backdrop blur (`rgba(255, 255, 255, 0.95)`) to maintain header visibility when scrolling through large drug registries.

## Shapes

The design system employs **Roundedness 2**, utilizing a base radius scale centered around 0.5rem (8px–10px) to balance modern software ergonomics with clinical precision:

- **Base Radius (`rounded-md` / 8px - 10px):** Form inputs, buttons, status chips, table rows, and KPI containers.
- **Large Radius (`rounded-lg` / 16px):** Dialog windows, major workflow modal dialogs, and slide-over panels.
- **Inner Element Pairing:** Child badges or nested pills within cards adopt a 6px border radius to preserve geometric concentricity with parent containers.

## Components

### Buttons
- **Primary:** Solid `#0F766E` background, `#FFFFFF` text, 10px border radius, 40px standard height. Hover triggers `#115E59` with a 150ms ease-in-out transition. Active triggers 0.98 scale transform.
- **Secondary / Outlined:** `#FFFFFF` surface, 1px solid `#E2E8F0` border, `#0F172A` text. Hover triggers `#F8FAFC` background and `#CBD5E1` border.
- **Destructive:** Solid `#E11D48` background, `#FFFFFF` text for permanent drug removals; `#FFF1F2` surface with `#E11D48` text and `#FECDD3` border for non-destructive actions.

### Status Chips (Triage Badges)
- Pill or rounded container (10px radius) with 4px vertical and 10px horizontal padding.
- Text rendered in `label-md` accompanied by an inline 14px directional or status icon placed on the right side of the Persian text label.
- Color matrix maps directly to Semantic Triage Tokens (e.g., Expiring Soon: `#FFF7ED` background, `#FFEDD5` border, `#EA580C` text and icon).

### Data Tables (Dense Pharmacy Inventory)
- **Header:** Sticky top, `#F8FAFC` background, 1px solid `#E2E8F0` bottom boundary, `label-md` text in `#475569`, text aligned to the right. Numerical headers (Units in Stock, Price per Unit) aligned to the left with RTL numerical ordering.
- **Row Anatomy:** Alternating or clean line separators (`#E2E8F0`). Row height capped at 48px. Hover triggers `#F0FDFA` transition.
- **Action Column:** Left-pinned in RTL layouts containing quick-edit, batch adjustment, and audit log shortcuts.

### Input Fields & Search Bars
- 40px height, 10px corner radius, `#FFFFFF` surface, 1px solid `#E2E8F0` border.
- Placeholder text in `#94A3B8`.
- Focus state applies an active border of `#0F766E` and a 3px outer glow ring of `rgba(15, 118, 110, 0.12)`.
- Global search includes integrated prefix keyboard shortcut indicators and a clear button aligned to the left of the input container.

### Checkboxes & Radios
- Size: 18px x 18px.
- Unchecked: `#FFFFFF` surface, 1.5px solid `#CBD5E1` border, 4px border radius for checkboxes.
- Checked: Solid `#0F766E` background with a crisp white checkmark check indicator.

### KPI Summary Cards
- `#FFFFFF` surface with 1px solid `#E2E8F0` border.
- Header row with descriptive secondary title and matching semantic icon badge.
- Prominent numerical metric displayed using bold tabular Persian numbers.
- Sub-label displaying weekly inventory delta with directional indicator icons.