import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from '@/components/ui/icon'
import {
  DIRECT_STITCH_ICONS,
  MISSING_STITCH_ICON_MAPPINGS,
  STITCH_ICON_MAP,
  STATUS_ICON_MAP,
  resolveIcon,
} from '@/lib/icons'

const FRONTEND_ROOT = path.resolve(__dirname, '../..')
const APP_ROOT = path.resolve(__dirname, '../../..')

describe('Centralized Material Symbols Icon Mapping', () => {
  it('preserves all 214 Stitch icon names from EXTRACTED.md and resolves to valid Material Symbols', () => {
    const extracted = fs.readFileSync(
      path.join(APP_ROOT, 'docs/stitch-reference/EXTRACTED.md'),
      'utf8',
    )
    const section = extracted.split('### 5.1 Material Symbols Outlined')[1]?.split('### 5.2')[0] ?? ''
    const stitchNames = Array.from(section.matchAll(/`([a-z0-9_]+)`/g), (m) => m[1] ?? '')

    const dts = fs.readFileSync(
      path.join(FRONTEND_ROOT, 'node_modules/material-symbols/index.d.ts'),
      'utf8',
    )
    const validMaterialSymbols = new Set(Array.from(dts.matchAll(/"([a-z0-9_]+)"/g), (m) => m[1] ?? ''))

    expect(stitchNames).toHaveLength(214)
    expect(DIRECT_STITCH_ICONS).toHaveLength(202)
    expect(Object.keys(MISSING_STITCH_ICON_MAPPINGS)).toHaveLength(12)
    expect(Object.keys(STITCH_ICON_MAP)).toHaveLength(214)

    for (const name of stitchNames) {
      const resolved = resolveIcon(name)
      expect(validMaterialSymbols.has(resolved.symbol)).toBe(true)
    }

    for (const statusIcon of Object.values(STATUS_ICON_MAP)) {
      expect(STITCH_ICON_MAP[statusIcon]).toBeDefined()
    }
  })

  it('maps legacy Stitch icon names and applies FILL variation properly', () => {
    const expandMore = resolveIcon('expand_more')
    expect(expandMore.symbol).toBe('keyboard_arrow_down')
    expect(expandMore.isMappedFallback).toBe(true)

    const filledClock = resolveIcon('access_time_filled')
    expect(filledClock.symbol).toBe('schedule')
    expect(filledClock.filled).toBe(true)
    expect(filledClock.isMappedFallback).toBe(true)
  })

  it('renders decorative and accessible Icon elements', () => {
    const { container } = render(
      <div>
        <Icon name="expand_more" size={18} />
        <Icon name="local_pharmacy" size={24} filled label="انبار دارو" />
      </div>,
    )

    const decorative = container.querySelector('[data-icon-requested="expand_more"]')
    expect(decorative).toHaveAttribute('data-icon-resolved', 'keyboard_arrow_down')
    expect(decorative).toHaveAttribute('aria-hidden', 'true')
    expect(decorative).toHaveTextContent('keyboard_arrow_down')

    const labeled = screen.getByRole('img', { name: 'انبار دارو' })
    expect(labeled).toHaveAttribute('data-icon-resolved', 'local_pharmacy')
    expect(labeled.getAttribute('style')).toContain("'FILL' 1")
  })
})
