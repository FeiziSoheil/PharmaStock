# Extracted Tokens, Values, Icons & Components (As-Is)

Source: all 17 HTML screens (`screens/*/screen.html`), `DESIGN.md`, and `screens/design-system-spec/screen.md` (Stitch screen `73ba554f75764a609fee99d9257070c5`) exported from Stitch project `PharmaStock Pharmacy Admin System` (`projects/9552712134512523193`).

All values below are recorded verbatim without normalization or cleanup. Conflicts across `DESIGN.md`, `design-system-spec/screen.md`, and generated `screen.html` files are documented in [Section 7: Conflicts](#7-conflicts).

---

## 1. Colors

### 1.1 Tailwind Config Color Tokens (identical across all 17 `screen.html` files)

| Token | Hex Value |
| --- | --- |
| `primary` | `#005c55` |
| `on-primary` | `#ffffff` |
| `primary-container` | `#0f766e` |
| `on-primary-container` | `#a3faef` |
| `primary-fixed` | `#9cf2e8` |
| `primary-fixed-dim` | `#80d5cb` |
| `on-primary-fixed` | `#00201d` |
| `on-primary-fixed-variant` | `#00504a` |
| `inverse-primary` | `#80d5cb` |
| `secondary` | `#216963` |
| `on-secondary` | `#ffffff` |
| `secondary-container` | `#a8ece5` |
| `on-secondary-container` | `#266d68` |
| `secondary-fixed` | `#abefe8` |
| `secondary-fixed-dim` | `#8fd3cc` |
| `on-secondary-fixed` | `#00201e` |
| `on-secondary-fixed-variant` | `#00504b` |
| `tertiary` | `#005e40` |
| `on-tertiary` | `#ffffff` |
| `tertiary-container` | `#007954` |
| `on-tertiary-container` | `#99ffce` |
| `tertiary-fixed` | `#85f8c4` |
| `tertiary-fixed-dim` | `#68dba9` |
| `on-tertiary-fixed` | `#002114` |
| `on-tertiary-fixed-variant` | `#005137` |
| `error` | `#ba1a1a` |
| `on-error` | `#ffffff` |
| `error-container` | `#ffdad6` |
| `on-error-container` | `#93000a` |
| `background` | `#f7f9fb` |
| `on-background` | `#191c1e` |
| `surface` | `#f7f9fb` |
| `surface-dim` | `#d8dadc` |
| `surface-bright` | `#f7f9fb` |
| `surface-container-lowest` | `#ffffff` |
| `surface-container-low` | `#f2f4f6` |
| `surface-container` | `#eceef0` |
| `surface-container-high` | `#e6e8ea` |
| `surface-container-highest` | `#e0e3e5` |
| `surface-variant` | `#e0e3e5` |
| `surface-tint` | `#006a63` |
| `on-surface` | `#191c1e` |
| `on-surface-variant` | `#3e4947` |
| `inverse-surface` | `#2d3133` |
| `inverse-on-surface` | `#eff1f3` |
| `outline` | `#6e7977` |
| `outline-variant` | `#bdc9c6` |

### 1.2 Additional Colors Documented in `DESIGN.md` Prose & `design-system-spec/screen.md` (Not in Tailwind Config)

- **Primary / Hover / Tint:** `#0F766E`, `#115E59`, `#F0FDFA`, `#99F6E4` (`design-system-spec/screen.md` only)
- **Canvas / Border / Text Neutrals:** `#F8FAFC`, `#FFFFFF`, `#E2E8F0`, `#F1F5F9` (`design-system-spec/screen.md` only), `#CBD5E1` (`DESIGN.md` only), `#0F172A`, `#475569`, `#94A3B8`
- **Semantic Triage Swatches:**
  - Safe / Available: `#059669`, `#ECFDF5`, `#A7F3D0`
  - Warning / Low Stock: `#D97706`, `#FFFBEB`, `#FDE68A`
  - Expiring Soon: `#EA580C`, `#FFF7ED`, `#FFEDD5`
  - Critical / Expired: `#E11D48`, `#FFF1F2`, `#FECDD3`

### 1.3 Arbitrary Hex & RGBA Values Observed in HTML Bodies

- **Hex in HTML classes:**
  - `#EA580C` (20 occurrences: `text-[#EA580C]`, `bg-[#EA580C]`)
  - `#0F766E` (12 occurrences: `shadow-[0_0_0_2px_#0F766E]` and ring/border utilities)
  - `#FFF7ED` (10 occurrences: `bg-[#FFF7ED]`)
  - `#D97706` (8 occurrences: `text-[#D97706]`, `bg-[#D97706]`)
  - `#FFFBEB` (4 occurrences: `bg-[#FFFBEB]`)
  - `#059669` (4 occurrences: `text-[#059669]`, `bg-[#059669]`)
  - `#ECFDF5` (2 occurrences: `bg-[#ECFDF5]`)
- **RGBA in HTML classes:**
  - `rgba(0,0,0,0.04)` (32 occurrences, e.g. `shadow-[0_1px_8px_rgba(0,0,0,0.04)]`)
  - `rgba(0,92,85,0.2)` (4 occurrences: `shadow-[0_0_0_2px_rgba(0,92,85,0.2)]`)
  - `rgba(224,227,229,0.5)` (3 occurrences: `shadow-[0_1px_0_rgba(224,227,229,0.5)]`)
  - `rgba(0,0,0,0.06)` (2 occurrences: `shadow-[0_-4px_16px_rgba(0,0,0,0.06)]`, `shadow-[0_1px_0_rgba(0,0,0,0.06)]`)
  - `rgba(15,118,110,0.2)` (2 occurrences: `shadow-[0_0_0_2px_rgba(15,118,110,0.2)]`)
- **RGBA documented in `DESIGN.md` prose (not found in HTML):**
  - `rgba(15, 23, 42, 0.05)`, `rgba(15, 23, 42, 0.12)`, `rgba(255, 255, 255, 0.95)`, `rgba(15, 118, 110, 0.12)`

### 1.4 Tailwind Color Utilities Used in HTML Bodies

- **Semantic config tokens & opacity variants:**
  - `bg-primary`, `bg-primary/5`, `bg-primary/10`, `bg-primary/20`, `text-primary`, `text-primary/30`, `border-primary`, `border-primary/20`, `border-primary/40`, `ring-primary`, `ring-primary/20`, `accent-primary`
  - `bg-primary-container`, `bg-primary-container/10`, `text-primary-container`, `border-primary-container`, `ring-primary-container`, `ring-primary-container/20`, `accent-primary-container`
  - `text-on-primary`, `text-on-primary-container`, `bg-primary-fixed`, `bg-primary-fixed/40`, `bg-primary-fixed-dim/30`, `bg-on-primary-fixed-variant`, `text-on-primary-fixed-variant`
  - `bg-secondary`, `bg-secondary/90`, `text-secondary`, `border-secondary`, `text-on-secondary`
  - `bg-secondary-container`, `bg-secondary-container/5`, `bg-secondary-container/10`, `bg-secondary-container/20`, `bg-secondary-container/25`, `bg-secondary-container/30`, `bg-secondary-container/40`, `bg-secondary-container/50`, `bg-secondary-container/60`, `text-secondary-container`, `text-on-secondary-container`, `text-on-secondary-container/80`
  - `bg-secondary-fixed`, `bg-secondary-fixed/40`, `bg-secondary-fixed-dim/30`, `text-on-secondary-fixed`, `text-on-secondary-fixed-variant`
  - `bg-tertiary`, `bg-tertiary/10`, `text-tertiary`, `text-tertiary/30`, `border-tertiary/20`, `ring-tertiary`, `text-on-tertiary`
  - `bg-tertiary-container`, `bg-tertiary-container/10`, `bg-tertiary-container/15`, `bg-tertiary-container/20`, `bg-tertiary-container/30`, `bg-on-tertiary-container`
  - `bg-tertiary-fixed`, `bg-tertiary-fixed/30`, `bg-tertiary-fixed-dim/20`, `text-on-tertiary-fixed`, `text-on-tertiary-fixed-variant`
  - `bg-error`, `bg-error/5`, `bg-error/10`, `bg-error/20`, `bg-error/90`, `text-error`, `text-on-error`
  - `bg-error-container`, `bg-error-container/10`, `bg-error-container/20`, `bg-error-container/30`, `bg-error-container/40`, `bg-error-container/60`, `bg-error-container/70`, `bg-on-error-container`, `text-on-error-container`
  - `bg-background`, `bg-surface`, `bg-surface/90`, `bg-surface-bright`, `bg-surface-bright/40`, `bg-surface-variant`, `text-surface-dim`
  - `bg-surface-container-lowest`, `bg-surface-container-lowest/60`, `bg-surface-container-lowest/80`, `bg-surface-container-lowest/90`, `bg-surface-container-lowest/95`, `text-surface-container-lowest`, `border-surface-container-lowest`
  - `bg-surface-container-low`, `bg-surface-container-low/40`, `bg-surface-container-low/50`, `bg-surface-container-low/60`, `bg-surface-container-low/70`, `border-surface-container-low`, `divide-surface-container-low`
  - `bg-surface-container`, `border-surface-container`, `divide-surface-container`, `accent-surface-container`
  - `bg-surface-container-high`, `bg-surface-container-high/40`, `bg-surface-container-high/60`, `border-surface-container-high`, `divide-surface-container-high`
  - `bg-surface-container-highest`, `text-surface-container-highest`, `border-surface-container-highest`, `divide-surface-container-highest`
  - `bg-on-surface`, `bg-on-surface/40`, `text-on-surface`, `bg-on-surface-variant`, `text-on-surface-variant`, `text-on-surface-variant/40`, `text-on-surface-variant/60`
  - `bg-inverse-surface`, `bg-inverse-surface/30`, `bg-inverse-surface/40`, `bg-inverse-surface/60`, `text-inverse-on-surface`
  - `bg-outline`, `text-outline`, `border-outline`, `bg-outline-variant`, `text-outline-variant`, `border-outline-variant`
- **Hardcoded Tailwind default palette utilities (outside config):**
  - Emerald: `bg-emerald-50`, `bg-emerald-50/70`, `text-emerald-800`, `text-emerald-900`
  - Amber: `bg-amber-50`, `bg-amber-50/20`, `bg-amber-50/70`, `bg-amber-100`, `bg-amber-200`, `bg-amber-500/5`, `bg-amber-500/10`, `bg-amber-500/15`, `bg-amber-600`, `bg-amber-700`, `bg-amber-800`, `bg-amber-900`, `text-amber-600`, `text-amber-700`, `text-amber-800`, `text-amber-900`, `text-amber-950`
  - Orange: `bg-orange-50`, `bg-orange-50/20`, `bg-orange-50/70`, `bg-orange-100`, `bg-orange-200`, `bg-orange-600`, `text-orange-700`, `text-orange-800`, `text-orange-900`, `text-orange-950`
  - Rose: `bg-rose-50/30`, `bg-rose-100`, `bg-rose-200`, `bg-rose-300`, `bg-rose-700`, `text-rose-800`, `text-rose-900`, `text-rose-950`
  - Blue: `bg-blue-50`, `text-blue-700`, `text-blue-800`
  - Neutral/Generic: `bg-white`, `text-white`, `border-white`, `bg-black/40`, `bg-transparent`, `border-transparent`

---

## 2. Fonts & Typography

### 2.1 Google Fonts `<link>` Imports in `<head>`

- `https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap` (15 screens)
- `https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap` (2 screens: `dashboard`, `login`)
- `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200` (17 screens)
- `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap` (duplicated across all 17 screens)

### 2.2 `<style>` Base Font Rules

- 15 screens set `html, body { margin: 0; padding: 0; font-family: 'Vazirmatn', sans-serif; }`
- 2 screens (`dashboard`, `login`) omit `font-family` from the base `<style>` rule (`html, body { margin: 0; padding: 0; }`).

### 2.3 Tailwind `fontFamily` Tokens

- 12 screens (`audit-log`, `auto-reorder-suggestions`, `controlled-substances-ledger`, `dashboard-inventory`, `distributor-returns`, `drug-catalog`, `drug-details-cardex`, `expiry-alerts-fefo`, `invoice-receipts`, `periodic-stocktake`, `purchase-invoice-reconciliation`, `users-permissions`): all 12 roles mapped to `["Vazirmatn", "Inter"]`
- 3 screens (`dispensing-dispatch`, `internal-transfer`, `shelf-inventory`): all 12 roles mapped to `["Vazirmatn", "sans-serif"]`
- 2 screens (`dashboard`, `login`): all 12 roles mapped to `["Inter"]`

### 2.4 Tailwind `fontSize` Scale (identical across all 17 `screen.html` files and `DESIGN.md` YAML)

| Token | Size | Line Height | Weight | Letter Spacing |
| --- | --- | --- | --- | --- |
| `headline-xl` | `2rem` | `2.75rem` | `700` | `-0.02em` |
| `headline-lg` | `1.5rem` | `2.25rem` | `700` | `-0.01em` |
| `headline-md` | `1.25rem` | `1.875rem` | `600` | — |
| `headline-sm` | `1.125rem` | `1.75rem` | `600` | — |
| `title-md` | `1rem` | `1.5rem` | `600` | — |
| `body-lg` | `1rem` | `1.625rem` | `400` | — |
| `body-md` | `0.875rem` | `1.5rem` | `400` | — |
| `body-sm` | `0.75rem` | `1.25rem` | `400` | — |
| `label-lg` | `0.875rem` | `1.25rem` | `600` | — |
| `label-md` | `0.75rem` | `1rem` | `500` | — |
| `label-sm` | `0.6875rem` | `0.875rem` | `500` | — |
| `data-tabular` | `0.875rem` | `1.25rem` | `500` | — |

### 2.5 Additional Font Utilities Observed in HTML Bodies

- **Font family utility:** `font-mono` (73 occurrences), plus token classes `font-label-sm`, `font-data-tabular`, `font-label-md`, `font-body-md`, `font-body-sm`, `font-label-lg`, `font-title-md`, `font-headline-sm`, `font-headline-xl`, `font-headline-lg`, `font-headline-md`
- **Standard Tailwind font sizes:** `text-xs` (7), `text-sm` (5), `text-base` (5)
- **Arbitrary pixel font sizes (primarily on icons and custom badges/KPIs):** `text-[9px]` (1), `text-[10px]` (4), `text-[11px]` (48), `text-[12px]` (8), `text-[13px]` (8), `text-[14px]` (147), `text-[15px]` (8), `text-[16px]` (105), `text-[18px]` (293), `text-[20px]` (243), `text-[22px]` (25), `text-[24px]` (70), `text-[28px]` (7), `text-[32px]` (5), `text-[44px]` (1)
- **Weights:** `font-normal` (24), `font-medium` (80), `font-semibold` (185), `font-bold` (539), `font-extrabold` (1), `font-black` (5)
- **Line height & tracking:** `leading-relaxed` (12), `leading-tight` (2), `leading-none` (1); `tracking-wider` (16), `tracking-tight` (11), `tracking-widest` (2), `tracking-wide` (1)

---

## 3. Radii

### 3.1 Tailwind Config `borderRadius` (identical across all 17 `screen.html` files)

- `DEFAULT`: `0.25rem`
- `lg`: `0.5rem`
- `xl`: `0.75rem`
- `full`: `9999px`

### 3.2 `DESIGN.md` YAML `rounded`

- `sm`: `0.25rem`
- `DEFAULT`: `0.5rem`
- `md`: `0.75rem`
- `lg`: `1rem`
- `xl`: `1.5rem`
- `full`: `9999px`

### 3.3 `rounded*` Classes Observed in HTML Bodies

| Class | Occurrences | Screens |
| --- | --- | --- |
| `rounded-xl` | 562 | 17 screens (all) |
| `rounded-full` | 338 | 17 screens (all) |
| `rounded-lg` | 302 | 15 screens |
| `rounded` | 266 | 17 screens (all) |
| `rounded-[10px]` | 211 | 5 screens (`auto-reorder-suggestions`, `dashboard-inventory`, `distributor-returns`, `expiry-alerts-fefo`, `purchase-invoice-reconciliation`) |
| `rounded-[8px]` | 27 | 2 screens (`auto-reorder-suggestions`, `expiry-alerts-fefo`) |
| `rounded-[6px]` | 18 | 1 screen (`expiry-alerts-fefo`) |
| `rounded-md` | 8 | 2 screens (`audit-log`, `shelf-inventory`) |
| `rounded-r-lg` | 4 | 2 screens (`dashboard`, `internal-transfer`) |
| `rounded-l-lg` | 4 | 2 screens (`dashboard`, `internal-transfer`) |
| `rounded-[12px]` | 1 | 1 screen (`expiry-alerts-fefo`) |
| `rounded-t-xl` | 1 | 1 screen (`invoice-receipts`) |

---

## 4. Spacing Values

### 4.1 Tailwind Config `spacing` Tokens (all 17 `screen.html` files & `DESIGN.md` YAML)

- `space-xs`: `0.25rem`
- `space-sm`: `0.5rem`
- `space-md`: `1rem`
- `space-lg`: `1.5rem`
- `space-xl`: `2rem`
- `gutter`: `1rem`
- `gutter-lg`: `1.5rem`
- `margin`: `1.5rem`
- `margin-mobile`: `1rem`

### 4.2 Spacing Classes Used Across HTML Bodies

- **Token-based classes:**
  - Padding: `p-space-xs`, `p-space-sm`, `p-space-md`, `p-space-lg`, `p-space-xl`, `p-gutter`, `p-gutter-lg`, `px-space-xs`, `px-space-sm`, `px-space-md`, `px-space-lg`, `px-space-xl`, `px-gutter`, `px-gutter-lg`, `py-space-xs`, `py-space-sm`, `py-space-md`, `py-space-lg`, `pt-space-xs`, `pt-space-sm`, `pt-space-md`, `pb-space-xs`, `pb-space-sm`, `pb-space-md`, `pb-space-xl`, `pr-space-xs`, `pr-space-sm`, `pr-space-md`, `pl-space-xs`, `pl-space-md`
  - Margin: `mt-space-xs`, `mt-space-sm`, `mt-space-md`, `mt-space-lg`, `mb-space-xs`, `mb-space-sm`, `mb-space-md`, `mb-space-lg`, `mb-space-xl`, `mr-space-xs`, `ml-space-sm`, `my-space-xs`, `my-space-sm`, `my-space-lg`, `-m-space-md`, `-mx-space-md`, `-mt-space-md`
  - Gap / Space: `gap-space-xs`, `gap-space-sm`, `gap-space-md`, `gap-space-lg`, `gap-x-space-md`, `gap-gutter`, `gap-gutter-lg`, `space-y-space-xs`, `space-y-space-sm`, `space-y-space-md`, `space-y-space-lg`, `space-y-gutter-lg`
- **Numeric Tailwind scale classes:**
  - Padding: `p-0`, `p-0.5`, `p-1`, `p-1.5`, `p-2`, `p-2.5`, `p-4`, `px-1`, `px-1.5`, `px-2`, `px-2.5`, `px-3`, `px-3.5`, `px-4`, `px-5`, `px-6`, `py-0.2`, `py-0.5`, `py-1`, `py-1.5`, `py-2`, `py-2.5`, `py-3`, `py-3.5`, `pt-1`, `pt-2`, `pt-2.5`, `pt-16`, `pb-0`, `pb-1`, `pb-2`, `pb-24`, `pr-0`, `pr-1`, `pr-3`, `pr-3.5`, `pr-4`, `pr-8`, `pr-9`, `pr-10`, `pr-11`, `pr-64`, `pl-3`, `pl-4`, `pl-8`, `pl-10`, `pl-16`, `pl-24`, `pl-28`
  - Arbitrary padding: `pr-[260px]` (15 screens)
  - Margin: `mt-0.5`, `mt-1`, `mt-2`, `mt-3`, `mb-0.5`, `mb-1`, `mb-1.5`, `mb-2`, `mr-1`, `mr-2`, `mr-auto`, `ml-auto`, `mx-1`, `mx-auto`, `my-1`, `-mb-px`, `-mr-[13px]`
  - Gap / Space: `gap-0.5`, `gap-1`, `gap-1.5`, `gap-2`, `gap-y-1`, `space-y-0.5`, `space-y-1`

---

## 5. Icon Names

All 17 HTML screens use Google **Material Symbols Outlined** (`<span class="material-symbols-outlined ...">...</span>`, 906 total usages, **214 unique icon names**), plus 3 inline `<svg>` decorative/signature graphics.

### 5.1 Material Symbols Outlined (214 unique names)

`ac_unit` (8), `access_time_filled` (1), `account_balance_wallet` (2), `account_tree` (1), `add` (3), `add_box` (3), `add_circle` (18), `add_shopping_cart` (1), `admin_panel_settings` (1), `alarm` (4), `analytics` (6), `announcement` (1), `approval` (1), `arrow_back` (4), `arrow_downward` (2), `arrow_forward` (2), `arrow_left` (7), `arrow_upward` (3), `assignment_late` (3), `assignment_return` (2), `assignment_turned_in` (2), `auto_awesome` (1), `auto_fix_high` (1), `badge` (4), `barcode` (3), `barcode_reader` (1), `barcode_scanner` (4), `block` (8), `bolt` (3), `calendar_clock` (1), `calendar_month` (4), `calendar_today` (3), `cell_tower` (1), `check` (8), `check_circle` (37), `checklist_rtl` (1), `chevron_left` (19), `chevron_right` (7), `clear_all` (1), `clinical_notes` (1), `close` (25), `code` (1), `content_copy` (1), `countertops` (2), `dangerous` (1), `dashboard` (1), `date_range` (2), `delete` (8), `delete_forever` (1), `delete_sweep` (4), `description` (2), `difference` (1), `do_not_disturb` (1), `domain` (6), `domain_verification` (1), `done` (2), `done_all` (1), `download` (7), `drafts` (1), `e911_emergency` (1), `edit` (14), `edit_note` (8), `emergency` (3), `enhanced_encryption` (2), `error` (3), `event` (1), `event_available` (3), `event_busy` (2), `event_note` (1), `expand_less` (3), `expand_more` (36), `fact_check` (2), `factory` (1), `fiber_new` (1), `file_download` (3), `filter_alt` (1), `filter_alt_off` (1), `fingerprint` (1), `first_page` (1), `format_image_left` (4), `format_list_bulleted` (1), `format_list_numbered` (1), `gavel` (2), `grid_goldenratio` (1), `grid_view` (6), `group` (1), `help_outline` (1), `history` (8), `history_toggle_off` (1), `hourglass_empty` (1), `hourglass_top` (2), `hub` (2), `info` (2), `input` (1), `inventory` (5), `inventory_2` (15), `key` (4), `keyboard_return` (1), `kitchen` (2), `label` (5), `last_page` (1), `layers` (4), `library_add` (1), `light_mode` (2), `local_pharmacy` (33), `local_shipping` (4), `location_on` (5), `lock` (11), `lock_clock` (3), `lock_person` (1), `lock_reset` (1), `login` (2), `logout` (1), `low_priority` (1), `map` (1), `medical_services` (1), `medication` (15), `medication_liquid` (2), `menu_book` (3), `mode_fan` (1), `monitor_heart` (1), `more_vert` (6), `move_up` (1), `near_me` (4), `nest_clock_farsight_analog` (1), `new_releases` (1), `notification_important` (7), `notifications` (16), `notifications_active` (1), `output` (9), `output_circle` (1), `payments` (2), `pending_actions` (1), `person` (5), `person_add` (2), `picture_as_pdf` (3), `pill` (5), `play_arrow` (1), `playlist_add` (2), `point_of_sale` (3), `policy` (5), `post_add` (1), `prescriptions` (3), `price_change` (2), `price_check` (2), `print` (10), `priority_high` (5), `production_quantity_limits` (1), `progress_activity` (1), `published_with_changes` (1), `qr_code_2` (2), `qr_code_scanner` (3), `receipt` (4), `receipt_long` (26), `refresh` (6), `remove` (1), `replay` (3), `reply` (3), `reply_all` (1), `restart_alt` (1), `rule` (3), `save` (5), `save_clock` (1), `schedule` (2), `schedule_send` (1), `science` (1), `search` (26), `search_check` (1), `security` (3), `send_and_archive` (1), `send_to_mobile` (1), `sensors` (2), `settings` (6), `severe_cold` (3), `shelves` (7), `shield` (4), `shield_person` (1), `shield_with_heart` (1), `shopping_cart_checkout` (2), `show_chart` (6), `skip_next` (1), `sort` (1), `store` (6), `storefront` (1), `swap_horiz` (28), `swap_horizontal_circle` (1), `swap_vert` (4), `swap_vertical_circle` (1), `sync` (4), `sync_alt` (5), `syringe` (1), `table_view` (2), `tag` (1), `task_alt` (6), `terminal` (6), `thermostat` (7), `timelapse` (1), `timer` (3), `token` (1), `transfer_within_a_station` (1), `trending_down` (2), `trending_up` (2), `tune` (12), `unfold_more` (1), `vaccines` (5), `verified` (30), `verified_user` (15), `view_column` (2), `view_list` (1), `visibility` (2), `warehouse` (10), `warning` (11), `water_drop` (3), `west` (1).

### 5.2 Inline SVGs

- `login`: 1 inline `<svg>` decorative vector path (`opacity-30 pointer-events-none`)
- `internal-transfer`: 2 inline `<svg>` handwritten signature curves (`w-48 h-16`)

---

## 6. Repeated Components Across Screens

1. **RTL Right-Fixed Sidebar (`<aside>`)** — 16 screens (all except `login`):
   - Fixed right (`fixed right-0 top-0 h-full`), `bg-surface-container-lowest`, `shadow-[0_1px_8px_rgba(0,0,0,0.04)]`, `z-50`, `flex flex-col justify-between`.
   - Width: `w-[260px]` on 15 screens; `w-64` (256px) on `dashboard`.
   - Contains PharmaStock logo (`local_pharmacy`), navigation link list (`9`, `10`, `12`, or `13` `<a href>` items depending on screen), and bottom user profile/role block.
2. **Top Header Bar (`<header>`)** — all 17 screens:
   - 16 dashboard screens: `fixed top-0 left-0 h-16` (`64px`) with `right-[260px]` (15 screens) or `right-64` (`dashboard`), `backdrop-blur-xl`, `shadow-[0_1px_8px_rgba(0,0,0,0.04)]`, `z-40`, `flex items-center justify-between`. Houses branch selector (`شعبه مرکزی`), global search input, notification bell (`notifications`), quick-add button, and user avatar.
   - `login`: standalone non-fixed header (`w-full py-space-md px-gutter-lg`).
3. **KPI Metric Cards** — `dashboard`, `dashboard-inventory`, `expiry-alerts-fefo`, `auto-reorder-suggestions`, `controlled-substances-ledger`, `periodic-stocktake`, `audit-log`, `distributor-returns`, `purchase-invoice-reconciliation`, `shelf-inventory`, `drug-details-cardex`:
   - 2- to 5-column responsive grids (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`, `grid-cols-5`, etc.) with `bg-surface-container-lowest`, rounded cards (`rounded-xl` or `rounded-[10px]`), icon badge container, metric value (`font-data-tabular` or bold numeric), and delta/sub-label.
4. **Dense Data Tables (`<table>`)** — 15 screens (all except `login` and `dispensing-dispatch`):
   - Multi-column RTL inventory/audit/ledger tables with `sticky top-0` headers on several screens (`controlled-substances-ledger`, `dashboard-inventory`, `shelf-inventory`), row hover transitions (`hover:bg-primary/5`, `hover:bg-surface-container-low/60`, `hover:bg-secondary-container/20`, `hover:bg-error-container/20`), inline drug/batch metadata, status badges, and left-side row action buttons.
5. **Status Badges / Triage Chips** — all 17 screens:
   - Inline pill/rounded containers (`rounded-full` or `rounded-[10px]`) pairing semantic color tokens or Tailwind palette classes with a Material Symbol icon and Persian status text (valid/in-stock, low-stock, expiring soon, expired/critical, controlled/narcotic, pending/approved).
6. **Search & Filter Toolbars** — 16 screens (all except `login`):
   - Search `<input>` (`h-10` on 15 screens) paired with `<select>` dropdowns (13 screens), category/status filter chips, column visibility/export buttons (`print`, `download`, `tune`).
7. **Pagination Footer** — 10 screens (`audit-log`, `auto-reorder-suggestions`, `controlled-substances-ledger`, `dashboard-inventory`, `drug-catalog`, `drug-details-cardex`, `expiry-alerts-fefo`, `invoice-receipts`, `periodic-stocktake`, `shelf-inventory`):
   - Displays row counts and `chevron_right` / `chevron_left` (plus `first_page` / `last_page` on `audit-log`) page buttons.
8. **Multi-Step Steppers** — 5 screens (`internal-transfer`, `invoice-receipts`, `periodic-stocktake`, `purchase-invoice-reconciliation`, `shelf-inventory`).
9. **Side Drawers & Confirmation/Detail Modals** — 6 screens:
   - Slide-over drawers: `drug-catalog` (`max-w-[560px]` left-anchored drawer for TTAC / IRC lookup & drug registration), `dashboard-inventory`, `audit-log`.
   - Centered modals: `audit-log`, `controlled-substances-ledger`, `distributor-returns`, `expiry-alerts-fefo`.
10. **Form Controls & Tabs**:
    - Inputs (`h-10` across 15 screens; `h-11` in `internal-transfer`, `login`; `h-9` in `expiry-alerts-fefo`; `h-16` in `periodic-stocktake`; `py-2` in `dashboard`).
    - Buttons (`h-10`, `h-8`, `h-11`, `h-12`, `h-7`, `h-9`, `h-6`, `h-16`).
    - Checkboxes (11 screens), Radios (4 screens), Tabs (`drug-details-cardex`, `shelf-inventory`).
    - Sticky bottom action bar (`auto-reorder-suggestions`) and Toast notification (`dashboard-inventory`).

---

## 7. Conflicts

The following conflicts exist verbatim across the exported Stitch artifacts and are preserved without resolution:

1. **Primary / Surface / Border Palette Conflict (`DESIGN.md` YAML + Tailwind Config vs. `DESIGN.md` Prose & `design-system-spec/screen.md` vs. HTML Bodies):**
   - `DESIGN.md` YAML & all 17 Tailwind configs define Material 3 tokens: `primary: #005c55`, `primary-container: #0f766e`, `secondary: #216963`, `tertiary: #005e40`, `error: #ba1a1a`, `surface: #f7f9fb`, `background: #f7f9fb`, `outline-variant: #bdc9c6`, `on-surface: #191c1e`, `on-surface-variant: #3e4947`.
   - `DESIGN.md` prose & `design-system-spec/screen.md` define Tailwind/Slate-style tokens instead: `Primary: #0F766E`, `Primary Hover: #115E59`, `Primary Tint: #F0FDFA`, `Canvas: #F8FAFC`, `Border: #E2E8F0`, `Text Primary: #0F172A`, `Text Secondary: #475569`, `Text Muted: #94A3B8`, plus semantic swatches (`#059669`, `#ECFDF5`, `#A7F3D0`, `#D97706`, `#FFFBEB`, `#FDE68A`, `#EA580C`, `#FFF7ED`, `#FFEDD5`, `#E11D48`, `#FFF1F2`, `#FECDD3`).
   - Generated HTML screens mostly use the M3 config tokens (`primary`, `surface-container-*`, `tertiary`, `error`), **but** several screens mix in raw hex values (`text-[#EA580C]`, `bg-[#FFF7ED]`, `text-[#D97706]`, `bg-[#FFFBEB]`, `text-[#059669]`, `bg-[#ECFDF5]`) and default Tailwind color scales (`emerald-*`, `amber-*`, `orange-*`, `rose-*`, `blue-*`, `white`).

2. **Font Family Conflict (`Vazirmatn` vs. `Inter`):**
   - `DESIGN.md` YAML & `dashboard` + `login` Tailwind configs set all typography font families to `Inter` (and `dashboard` + `login` only load Google Font `Inter`, not `Vazirmatn`).
   - 12 screens configure `["Vazirmatn", "Inter"]` and load `Vazirmatn`.
   - 3 screens (`dispensing-dispatch`, `internal-transfer`, `shelf-inventory`) configure `["Vazirmatn", "sans-serif"]` and load `Vazirmatn`.
   - `design-system-spec/screen.md` specifies `Vazirmatn` exclusively.

3. **Typography Scale Conflict (`DESIGN.md` YAML / Tailwind Config vs. `design-system-spec/screen.md` vs. Arbitrary Sizes):**
   - Tailwind configs & `DESIGN.md` YAML use 12 M3-style roles (`headline-xl: 2rem`, `headline-lg: 1.5rem`, `headline-md: 1.25rem`, `headline-sm: 1.125rem`, `title-md: 1rem`, `body-lg: 1rem`, `body-md: 0.875rem`, `body-sm: 0.75rem`, `label-lg: 0.875rem`, `label-md: 0.75rem`, `label-sm: 0.6875rem`, `data-tabular: 0.875rem`).
   - `design-system-spec/screen.md` specifies a different 7-step scale (`Heading 1: 24px/36px`, `Heading 2: 18px/28px`, `Heading 3: 15px/24px`, `Body Large: 14px/22px`, `Body Regular: 13px/20px`, `Caption/Badge: 11px/12px`, `KPI Metric: 28px/34px`).
   - Screens also apply arbitrary pixel classes (`text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[14px]`, `text-[15px]`, `text-[16px]`, `text-[18px]`, `text-[20px]`, `text-[22px]`, `text-[24px]`, `text-[28px]`, `text-[32px]`, `text-[44px]`).

4. **Border Radius Conflict (4 Incompatible Scales):**
   - Tailwind config in all 17 screens: `DEFAULT: 0.25rem` (`4px`), `lg: 0.5rem` (`8px`), `xl: 0.75rem` (`12px`), `full: 9999px`.
   - `DESIGN.md` YAML: `sm: 0.25rem`, `DEFAULT: 0.5rem`, `md: 0.75rem`, `lg: 1rem`, `xl: 1.5rem`, `full: 9999px`.
   - `DESIGN.md` prose: base `8px - 10px` (`rounded-md`), large `16px` (`rounded-lg`), inner badges `6px`.
   - `design-system-spec/screen.md`: `10px` (`rounded-[10px]`) standard for cards/inputs/buttons/popups, `9999px` for status badges.
   - HTML bodies mix `rounded-xl` (562), `rounded-full` (338), `rounded-lg` (302), `rounded` (266), and arbitrary `rounded-[10px]` (211), `rounded-[8px]` (27), `rounded-[6px]` (18), `rounded-[12px]` (1), `rounded-md` (8).

5. **Elevation & Border Conflict (`DESIGN.md` Prose vs. Generated HTML):**
   - `DESIGN.md` prose & `design-system-spec/screen.md` mandate `1px solid #E2E8F0` borders with **no drop shadows** on Level 1 cards/tables.
   - Generated HTML screens largely omit `1px` borders on cards/sidebar/header and instead use `shadow-sm` (224 occurrences), `shadow-[0_1px_8px_rgba(0,0,0,0.04)]` (32 occurrences), `backdrop-blur-xl`, and tonal surface container steps (`bg-surface-container-lowest`, `bg-surface-container-low`). Only `dashboard` adds `border-l border-surface-container-high` on `<aside>` and `border-b border-surface-container-high` on `<header>`.

6. **Layout Shell & Navigation Inconsistencies Across Screens:**
   - Sidebar width: `w-[260px]` (15 screens) vs `w-64` (`256px`, `dashboard`).
   - Sidebar navigation link count varies: `9` links (`dashboard-inventory`, `dispensing-dispatch`, `expiry-alerts-fefo`, `internal-transfer`, `invoice-receipts`, `shelf-inventory`), `10` links (`dashboard`, `drug-catalog`, `drug-details-cardex`), `12` links (`audit-log`, `controlled-substances-ledger`, `periodic-stocktake`, `users-permissions`), `13` links (`auto-reorder-suggestions`, `distributor-returns`, `purchase-invoice-reconciliation`).
   - Page `<h1>` styling varies: `headline-md` (3 screens), `headline-lg` (11 screens), `headline-xl` (`controlled-substances-ledger`), or missing `<h1>` (`audit-log`, `dispensing-dispatch`).
   - Table `<thead>` styling varies across screens (`bg-surface-bright`, `bg-surface-container`, `bg-surface-container-low` with `backdrop-blur-md`, or unstyled `<thead>`).

7. **Spacing Token vs. Standard Scale Mixing:**
   - `DESIGN.md` and Tailwind configs define custom spacing tokens (`space-xs`–`space-xl`, `gutter`, `gutter-lg`, `margin`, `margin-mobile`), where `gutter` = `1rem` in `Clinical RTL Inventory` config, `space-xs` = `0.25rem` (`4px`).
   - HTML bodies mix these tokens (`px-space-md`, `py-space-sm`, `gap-space-xs`) heavily with standard Tailwind spacing utilities (`gap-1`, `py-2.5`, `py-0.5`, `py-3`, `px-2`, `px-3`, `py-3.5`, `p-1.5`, `gap-1.5`) including non-8px-grid values (`2px`, `6px`, `10px`, `12px`, `14px`).

8. **Dark Mode Config vs. Light-Only Implementation:**
   - All 17 HTML files include `darkMode: "class"` in `tailwind.config`, yet no `dark:` classes exist in any screen; only `login` renders a `light_mode` icon button.
