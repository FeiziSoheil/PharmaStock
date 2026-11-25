'use client'

import * as React from 'react'

/** Canonical PharmaStock layout breakpoints (Phase B tokens). */
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1280,
} as const

export type LayoutMode = 'mobile' | 'tablet' | 'desktop'

function resolveLayoutMode(width: number): LayoutMode {
  if (width < BREAKPOINTS.tablet) return 'mobile'
  if (width < BREAKPOINTS.desktop) return 'tablet'
  return 'desktop'
}

function subscribeViewport(listener: () => void) {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}

function getLayoutModeSnapshot(): LayoutMode {
  return resolveLayoutMode(window.innerWidth)
}

/**
 * Subscribes to viewport width and returns the clinical shell layout mode:
 * - mobile: < 768 (off-canvas nav)
 * - tablet: 768–1279 (collapsed rail)
 * - desktop: ≥ 1280 (full sidebar)
 *
 * The first client render uses `defaultMode` so it matches SSR, then the
 * live viewport is applied after hydration.
 */
export function useLayoutMode(defaultMode: LayoutMode = 'desktop'): LayoutMode {
  return React.useSyncExternalStore(
    subscribeViewport,
    getLayoutModeSnapshot,
    () => defaultMode,
  )
}

export function useMediaQuery(query: string, defaultMatches = false): boolean {
  const subscribe = React.useCallback((listener: () => void) => {
    const media = window.matchMedia(query)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  const getSnapshot = React.useCallback(
    () => window.matchMedia(query).matches,
    [query],
  )

  const getServerSnapshot = React.useCallback(
    () => defaultMatches,
    [defaultMatches],
  )

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
