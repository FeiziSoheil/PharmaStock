# Design: Floating App Shell (پنل‌های معلق)

**Date:** 2026-11-11  
**Stage:** Design  
**Status:** Approved in brainstorming; awaiting user review of this written spec  
**Scope:** Design-system tokens first, then `AppShell` / layout chrome  
**Approach:** CSS Grid shell with fixed gutters (Approach 1)

## 1. Goal

Replace the edge-to-edge application chrome with a full-page background canvas and three separate floating islands — sidebar, top navbar, and main content panel — each with rounded corners and a crisp border. Update the design system tokens and docs before changing layout components. Keep clinical light-only tokens, RTL ergonomics, and existing page content largely untouched.

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Island structure | **A** — three separate floating islands (sidebar, navbar, content); not glued together |
| Page background | **B+C** — mild slate→teal-tint gradient **and** a very subtle pattern on the base canvas |
| Float gap / inset | **B** — ~`16px` desktop; slightly tighter on mobile (`12px`) |
| Island surface treatment | **A** — `1px` border + rounded corners; **no card drop shadow** |
| Mobile (`<768`) | **C** — floating navbar + content only; sidebar only via Sheet (no fixed rail) |
| Scroll model | **A** — sidebar and navbar fixed in the viewport; **only** the content island scrolls |
| Implementation approach | **1** — Grid shell with shell inset/gap tokens (not independent `position: fixed` islands) |
| Login | Remains outside the floating shell |

## 3. Architecture

### Canvas

- Full viewport (`min-h-screen`) owned by `[data-slot="app-shell"]`.
- Background uses new semantic shell background tokens (gradient + pattern). Base color remains `#F8FAFC` / `--ps-bg`.
- No app page content renders directly on the canvas; only the three islands (plus mobile Sheet overlay).

### Desktop & tablet (≥768)

Outer shell padding = `--ps-shell-inset` (`16px`).

CSS Grid, two columns, column/row gap = `--ps-shell-gap` (`16px`):

Root shell uses `h-dvh` (or `h-screen`) + `overflow-hidden` so chrome does not rely on `position: fixed`/`sticky` for the scroll contract; the grid/flex geometry keeps sidebar and navbar in view.

1. **Sidebar island** — width `260px` expanded / `72px` collapsed (existing layout tokens). Height fills the grid row inside insets. Non-scrolling chrome; internal nav may `overflow-y-auto` if needed.
2. **Main column** — flex column with `gap = --ps-shell-gap` and `min-height: 0`:
   - **TopHeader island** — height `--ps-header-height` (`64px`); does not scroll away (sibling of the scroll region, not sticky overlay).
   - **Content island** — `flex: 1; min-height: 0; overflow: auto`. Sole vertical scroll region for page content.

Each island:

- `background: --ps-surface` (`#ffffff`)
- `border: 1px solid --ps-border`
- `border-radius: --ps-radius-panel` (`16px`)
- **No** `shadow-card` / level-1 drop shadow

Collapse toggle stays on the seam between sidebar and main column (existing control), adjusted for the new gap geometry — not a fourth floating card.

### Mobile (`<768`)

- No fixed sidebar rail.
- Shell padding = `--ps-shell-inset-mobile` (`12px`).
- Floating **TopHeader** + **Content** islands with `--ps-shell-gap`.
- Navigation via existing Sheet (`side="start"`); Sheet content is full sidebar, not a floating rail.

### Out of scope

- Restyling inner page cards, tables, or drawers beyond what the shell provides.
- Changing login visual panel.
- Dark mode / new themes beyond extending `clinical-light` shell background variables.
- Stronger elevation or glassmorphism on islands.

## 4. Design system updates (must land before UI)

### New / extended tokens

| Token | Value | Role |
|-------|-------|------|
| `--ps-shell-inset` | `16px` | Outer float padding (desktop/tablet) |
| `--ps-shell-inset-mobile` | `12px` | Outer float padding (mobile) |
| `--ps-shell-gap` | `16px` | Gap between the three islands |
| `--ps-radius-panel` | `16px` | Corner radius for floating shell islands (aligned with dialog) |
| `--ps-bg-shell` | mild slate→teal-tint gradient on `#F8FAFC` | Shell canvas fill |
| `--ps-bg-shell-pattern` | very low-contrast **dot grid** (`radial-gradient` points, low alpha) | Overlay pattern on canvas |

Unchanged: sidebar widths, header height, breakpoints, status colors, existing radius roles except adding `panel`.

Elevation policy for islands: border-only. Keep `--ps-shadow-shell` for incidental chrome (e.g. collapse chip) — **not** for the three islands.

### Files to update

- `src/tokens/primitives.ts` — layout inset/gap + panel radius if needed; pattern/gradient primitives as needed
- `src/tokens/semantic.ts` — `layout.shellInset`, `layout.shellGap`, `radius.panel`, shell background roles
- `src/tokens/themes.ts` / `index.ts` — export wiring
- `src/styles/tokens.css` — CSS custom properties
- `src/app/globals.css` — Tailwind v4 `@theme inline` bridges (`p-shell-inset`, `gap-shell-gap`, `rounded-panel`, `bg-shell`, etc.)
- `docs/design-tokens.md` — document new tokens + rationale
- `docs/design-system/PROGRESS.md` — log the floating-shell token/UI phase when implemented

### Tailwind / utility mapping (illustrative)

- spacing: `p-shell-inset`, `p-shell-inset-mobile`, `gap-shell-gap`
- radius: `rounded-panel`
- background: `bg-shell` (composites gradient + pattern via CSS on the shell root)

## 5. Component changes

### `AppShell` (`src/components/layout/app-shell.tsx`)

- Replace edge-to-edge + `ms-sidebar` margin model with inset Grid + floating islands.
- Apply `bg-shell` + shell inset on root.
- Assign island chrome (surface, border, radius, overflow) via `data-slot` wrappers so Sidebar/TopHeader stay visually flat inside the island.
- Preserve responsive modes from `useLayoutMode`: desktop collapsible, tablet forced collapsed rail, mobile Sheet.
- Content container max-width behavior may remain inside the content island; do not reintroduce full-bleed main padding that defeats the float.

### `Sidebar` / `TopHeader`

- Prefer shell-owned island framing over duplicating border/radius on the components themselves.
- Adjust any `fixed`/`sticky`/`h-screen`/`border-e` assumptions that assume viewport edge attachment.
- Mobile Sheet path unchanged in product behavior.

### Pages

- Screens already wrapped in `AppShell` inherit the new chrome with no per-page layout rewrite.
- Login stays outside `AppShell`.

## 6. Testing

- Update unit tests under `tests/unit/layout/` for:
  - presence of three island slots / shell inset classes or `data-slot`s
  - desktop/tablet grid vs mobile Sheet (no fixed rail)
  - content region as the scroll container (where assertable)
- Keep/adjust e2e smoke that authenticated shell pages render; confirm mobile menu still opens Sheet.
- `pnpm typecheck`, `pnpm lint`, targeted unit tests, and relevant e2e before claiming done.

## 7. Implementation order

1. Tokens + `tokens.css` + `globals.css` + `design-tokens.md`
2. `AppShell` restructure
3. Sidebar / TopHeader adjustments for non-edge layout
4. Tests + visual check RTL desktop/tablet/mobile
5. Progress log entry

## 8. Non-goals / explicit exclusions

- No fourth floating “utility” panel.
- No island drop shadows.
- No change to Persian main heading requirement or clinical-light-only constraint.
- No secrets, `.env`, or real backend work.
