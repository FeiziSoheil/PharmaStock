import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CSS_TOKEN_VARS,
  DEFAULT_THEME_ID,
  clinicalLightTokens,
  getThemeTokens,
  primitives,
  themes,
} from '@/tokens'

const APP_ROOT = path.resolve(__dirname, '../..')  // frontend root: src/styles + src/app live here

describe('Design Tokens System', () => {
  it('resolves the default clinical-light theme without dark-mode entries', () => {
    expect(DEFAULT_THEME_ID).toBe('clinical-light')
    expect(Object.keys(themes)).toEqual(['clinical-light'])

    const resolved = getThemeTokens()
    expect(resolved).toBe(clinicalLightTokens)
    expect(resolved.colorScheme).toBe('light')
  })

  it('applies approved canonical core palette and preserved Stitch inventory status colors', () => {
    const { colors } = getThemeTokens()

    // Core canonical colors
    expect(colors.background).toBe('#f8fafc')
    expect(colors.surface).toBe('#ffffff')
    expect(colors.border.default).toBe('#e2e8f0')
    expect(colors.text.primary).toBe('#0f172a')
    expect(colors.text.secondary).toBe('#475569')
    expect(colors.primary.default).toBe('#0f766e')
    expect(colors.primary.hover).toBe('#115e59')
    expect(colors.primary.tint).toBe('#f0fdfa')
    expect(colors.focus.ring).toBe('rgba(15, 118, 110, 0.12)')

    // Preserved Stitch inventory triage colors
    expect(colors.status.valid).toEqual({
      foreground: '#059669',
      background: '#ecfdf5',
      border: '#a7f3d0',
    })
    expect(colors.status.warning).toEqual({
      foreground: '#d97706',
      background: '#fffbeb',
      border: '#fde68a',
    })
    expect(colors.status.expiring).toEqual({
      foreground: '#ea580c',
      background: '#fff7ed',
      border: '#ffedd5',
    })
    expect(colors.status.critical).toEqual({
      foreground: '#e11d48',
      background: '#fff1f2',
      border: '#fecdd3',
    })
  })

  it('defines canonical radii, restrained elevation, spacing, typography, and layout tokens', () => {
    const tokens = getThemeTokens()

    expect(tokens.radius.default).toBe('10px')
    expect(tokens.radius.badge).toBe('9999px')
    expect(tokens.radius.checkbox).toBe('4px')
    expect(tokens.radius.dialog).toBe('16px')
    expect(tokens.radius.panel).toBe('16px')

    expect(tokens.elevation.level0).toBe('none')
    expect(tokens.elevation.level1).toBe('none')
    expect(tokens.elevation.level2).toContain('rgba(15, 23, 42, 0.05)')
    expect(tokens.elevation.level3).toContain('rgba(15, 23, 42, 0.12)')

    expect(tokens.layout.sidebarWidth).toBe('260px')
    expect(tokens.layout.sidebarCollapsedWidth).toBe('72px')
    expect(tokens.layout.headerHeight).toBe('64px')
    expect(tokens.layout.shellInset).toBe('16px')
    expect(tokens.layout.shellInsetMobile).toBe('12px')
    expect(tokens.layout.shellGap).toBe('16px')
    expect(tokens.layout.breakpoints).toEqual({
      tablet: '768px',
      desktop: '1280px',
    })
    expect(tokens.colors.backgroundShell).toContain('linear-gradient')
    expect(tokens.colors.backgroundShellPattern).toContain('radial-gradient')

    expect(tokens.typography.families.sans).toContain('Vazirmatn Variable')
    expect(tokens.typography.families.latin).toContain('Inter Variable')
    expect(tokens.typography.roles.kpi.fontSize).toBe(primitives.fontSizes.kpi)
    expect(tokens.spacing.gutter).toBe('1rem')
    expect(tokens.spacing.gutterLg).toBe('1.5rem')
  })

  it('declares every semantic CSS variable in tokens.css with no dark-mode selectors', () => {
    const tokensCss = fs.readFileSync(path.join(APP_ROOT, 'src/styles/tokens.css'), 'utf8')
    const globalsCss = fs.readFileSync(path.join(APP_ROOT, 'src/app/globals.css'), 'utf8')

    for (const cssVar of Object.values(CSS_TOKEN_VARS)) {
      expect(tokensCss).toContain(`${cssVar}:`)
    }

    // Tailwind v4 @theme inline wiring check
    expect(globalsCss).toContain('@theme inline')
    expect(globalsCss).toContain('--breakpoint-tablet: 48rem;')
    expect(globalsCss).toContain('--breakpoint-desktop: 80rem;')
    expect(globalsCss).toContain('--color-status-expiring-fg: var(--ps-status-expiring-fg);')
    expect(globalsCss).toContain('--radius-default: var(--ps-radius-default);')
    expect(globalsCss).toContain('.tabular-nums-data')

    // Strictly light-only
    expect(tokensCss).not.toMatch(/prefers-color-scheme:\s*dark/i)
    expect(tokensCss).not.toMatch(/\.dark\b/)
    expect(globalsCss).not.toMatch(/prefers-color-scheme:\s*dark/i)
    expect(globalsCss).not.toMatch(/\.dark\b/)
  })
})
