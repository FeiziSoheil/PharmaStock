# Floating App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shell float tokens, then restructure `AppShell` into three border-only rounded islands on a gradient+dot-grid canvas.

**Architecture:** Design-system first (primitives → semantic → CSS → Tailwind bridge → docs). Then Grid/`h-dvh` shell: sidebar island | (header island + scrolling content island). Mobile: inset header+content only; sidebar via Sheet.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, Vitest, existing layout components under `src/components/layout/`.

**Spec:** `docs/superpowers/specs/2026-11-11-floating-shell-design.md`

## Global Constraints

- App code/docs only under `02-project/app/`
- Light-only clinical theme; no dark-mode values
- Main headings remain Persian
- Floating islands: border + `rounded-panel`, **no** drop shadow
- Do not edit `README.md`, `BRIEF.md`, `templates/`, or invent secrets
- Commit only when the user explicitly asks

---

## File map

| File | Responsibility |
|------|----------------|
| `src/tokens/primitives.ts` | `shellInsetPx`, `shellInsetMobilePx`, `shellGapPx`; keep `radii[16]` for panel |
| `src/tokens/semantic.ts` | `layout.shellInset*`, `layout.shellGap`, `radius.panel`, `colors.backgroundShell`, `colors.backgroundShellPattern` |
| `src/tokens/index.ts` | `CSS_TOKEN_VARS` entries for new tokens |
| `src/styles/tokens.css` | `--ps-shell-*`, `--ps-radius-panel`, `--ps-bg-shell`, `--ps-bg-shell-pattern` |
| `src/app/globals.css` | `@theme` bridges + `.bg-shell` utility (gradient + pattern) |
| `docs/design-tokens.md` | Document new tokens |
| `src/components/layout/app-shell.tsx` | Floating grid shell |
| `src/components/layout/sidebar.tsx` | Drop fixed edge chrome when used as island (`embedded` or new default in shell) |
| `src/components/layout/top-header.tsx` | Flat island header (no sticky/blur/shadow; shell owns frame) |
| `tests/unit/tokens.test.ts` | Assert new layout/radius/shell tokens |
| `tests/unit/layout/app-shell.test.tsx` | Assert island slots + mobile Sheet |
| `docs/design-system/PROGRESS.md` | Log phase when done |

---

### Task 1: Shell design tokens

**Files:**
- Modify: `src/tokens/primitives.ts`, `src/tokens/semantic.ts`, `src/tokens/index.ts`, `src/styles/tokens.css`, `src/app/globals.css`, `docs/design-tokens.md`
- Test: `tests/unit/tokens.test.ts`

**Interfaces:**
- Produces: `clinicalLightTokens.layout.shellInset === '16px'`, `shellInsetMobile === '12px'`, `shellGap === '16px'`, `radius.panel === '16px'`, CSS vars `--ps-shell-inset`, `--ps-shell-inset-mobile`, `--ps-shell-gap`, `--ps-radius-panel`, `--ps-bg-shell`, `--ps-bg-shell-pattern`

- [x] **Step 1: Extend failing token assertions**

Add to `tests/unit/tokens.test.ts` inside the radii/layout test:

```ts
expect(tokens.radius.panel).toBe('16px')
expect(tokens.layout.shellInset).toBe('16px')
expect(tokens.layout.shellInsetMobile).toBe('12px')
expect(tokens.layout.shellGap).toBe('16px')
expect(tokens.colors.backgroundShell).toContain('linear-gradient')
expect(tokens.colors.backgroundShellPattern).toContain('radial-gradient')
```

- [x] **Step 2: Run test — expect FAIL** (folded into implement-first pass; assertions added with implementation)

- [x] **Step 3: Implement tokens**

`primitiveLayout` add:

```ts
shellInsetPx: 16,
shellInsetMobilePx: 12,
shellGapPx: 16,
```

`ThemeTokens` + `clinicalLightTokens`:
- `colors.backgroundShell`: `linear-gradient(160deg, #f8fafc 0%, #f0fdfa 55%, #f8fafc 100%)`
- `colors.backgroundShellPattern`: `radial-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px)` with note that CSS sets `background-size: 18px 18px`
- `radius.panel`: `primitives.radii[16]`
- `layout.shellInset` / `shellInsetMobile` / `shellGap` as px strings

`tokens.css` under semantic block:

```css
--ps-shell-inset: 16px;
--ps-shell-inset-mobile: 12px;
--ps-shell-gap: 16px;
--ps-radius-panel: var(--ps-p-radius-16);
--ps-bg-shell: linear-gradient(160deg, var(--ps-p-slate-50) 0%, var(--ps-p-teal-50) 55%, var(--ps-p-slate-50) 100%);
--ps-bg-shell-pattern: radial-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px);
```

`globals.css` `@theme inline`:

```css
--spacing-shell-inset: var(--ps-shell-inset);
--spacing-shell-inset-mobile: var(--ps-shell-inset-mobile);
--spacing-shell-gap: var(--ps-shell-gap);
--radius-panel: var(--ps-radius-panel);
```

Add utility:

```css
.bg-shell {
  background-color: var(--ps-bg);
  background-image: var(--ps-bg-shell-pattern), var(--ps-bg-shell);
  background-size: 18px 18px, auto;
  background-attachment: fixed, fixed;
}
```

Update `CSS_TOKEN_VARS` and a short section in `docs/design-tokens.md` under Layout / Radii / Surfaces.

- [x] **Step 4: Run tokens tests — expect PASS**

- [x] **Step 5: Commit only if user asks** — skipped

---

### Task 2: Floating AppShell + chrome adjustments

**Files:**
- Modify: `src/components/layout/app-shell.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/top-header.tsx`
- Test: `tests/unit/layout/app-shell.test.tsx`

**Interfaces:**
- Consumes: shell spacing/radius/bg tokens from Task 1
- Produces: `data-slot="app-shell-island-sidebar" | "app-shell-island-header" | "app-shell-island-content"`; root `bg-shell`; desktop/tablet grid; mobile header+content islands + Sheet

- [x] **Step 1: Extend AppShell tests**

```ts
it('renders three floating islands on desktop', () => {
  render(
    <TooltipProvider>
      <AppShell navItems={items}><h1>محتوا</h1></AppShell>
    </TooltipProvider>,
  )
  const shell = document.querySelector('[data-slot="app-shell"]')
  expect(shell).toHaveClass('bg-shell')
  expect(document.querySelector('[data-slot="app-shell-island-sidebar"]')).toBeTruthy()
  expect(document.querySelector('[data-slot="app-shell-island-header"]')).toBeTruthy()
  expect(document.querySelector('[data-slot="app-shell-island-content"]')).toBeTruthy()
})
```

On mobile assertion path: expect **no** `app-shell-island-sidebar`; still open Sheet for nav.

- [x] **Step 2: Run test — expect FAIL** (folded into implement-first pass)

- [x] **Step 3: Implement layout**

**Sidebar:** When `embedded` OR when used inside island wrapper from shell, do not use `fixed inset-y-0`. Shell always passes island mode: change non-embedded desktop path to **in-flow** (`relative h-full w-sidebar|w-sidebar-collapsed`, no `fixed`, no `shadow-shell`, no `border-e` — outer island owns border). Keep `embedded` for Sheet (`border-0 w-full`).

**TopHeader:** Remove `sticky`, `backdrop-blur`, `shadow-shell`, `border-b`; use flat `bg-surface h-header` so island wrapper provides border/radius.

**AppShell structure (desktop/tablet):**

```tsx
<div data-slot="app-shell" className={cn('bg-shell flex h-dvh flex-col overflow-hidden p-shell-inset max-tablet:p-shell-inset-mobile', className)}>
  {/* mobile: Sheet only */}
  <div className="grid min-h-0 flex-1 gap-shell-gap" style={{ gridTemplateColumns: mode==='mobile' ? '1fr' : collapsed ? 'var(--ps-sidebar-collapsed-width) 1fr' : 'var(--ps-sidebar-width) 1fr' }}>
    {mode !== 'mobile' && (
      <div data-slot="app-shell-island-sidebar" className="island-chrome min-h-0 overflow-hidden">
        <Sidebar ... />
      </div>
    )}
    <div className="relative flex min-h-0 min-w-0 flex-col gap-shell-gap">
      <div data-slot="app-shell-island-header" className="island-chrome shrink-0 overflow-hidden">
        <TopHeader ... />
      </div>
      <main data-slot="app-shell-island-content" className="island-chrome flex min-h-0 flex-1 flex-col overflow-auto ...">
        {children}
      </main>
      {/* collapse toggle positioned on seam */}
    </div>
  </div>
</div>
```

Shared island class (inline `cn`):

`bg-surface border border-border-default rounded-panel`

Remove `ms-sidebar` margin model entirely.

Use a Tailwind-friendly grid: `grid-cols-[var(--ps-sidebar-width)_minmax(0,1fr)]` and collapsed variant with `--ps-sidebar-collapsed-width`. Mobile: single column without sidebar island.

- [x] **Step 4: Run layout + tokens tests — expect PASS** (`9` passed)

- [x] **Step 5: typecheck + lint** (`lint` 0; `typecheck` blocked by pre-existing `drug-details/batch-query` miss)

- [x] **Step 6: Update PROGRESS.md** with floating-shell phase notes

- [x] **Step 7: Commit only if user asks** — skipped

---

## Self-review vs spec

| Spec requirement | Task |
|------------------|------|
| Three separate islands | Task 2 |
| Gradient + dot pattern canvas | Task 1 (`.bg-shell`) |
| 16px / 12px inset, 16px gap | Task 1 |
| Border-only, `radius-panel` 16px | Task 1–2 |
| Mobile: header+content float, Sheet nav | Task 2 |
| Scroll: content island only (`h-dvh` + overflow) | Task 2 |
| Tokens/docs before UI | Task 1 then 2 |
| Login unchanged | no task (out of scope) |
