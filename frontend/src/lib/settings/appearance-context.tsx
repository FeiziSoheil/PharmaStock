'use client'

import * as React from 'react'

export type ThemeId = 'clinical-light' | 'hospital-blue' | 'clinical-dark'
export type Density = 'comfortable' | 'compact'
export type FontSize = 'standard' | 'large'
export type SidebarDefault = 'expanded' | 'collapsed'

export interface AppearancePreferences {
  theme: ThemeId
  density: Density
  fontSize: FontSize
  sidebarDefault: SidebarDefault
}

export const defaultAppearance: AppearancePreferences = {
  theme: 'clinical-light',
  density: 'comfortable',
  fontSize: 'standard',
  sidebarDefault: 'expanded',
}

const STORAGE_KEY = 'pharmastock_appearance_pref_v1'

type AppearanceContextType = {
  appearance: AppearancePreferences
  updateAppearance: (updates: Partial<AppearancePreferences>) => void
  resetAppearance: () => void
}

const AppearanceContext = React.createContext<AppearanceContextType | undefined>(undefined)

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = React.useState<AppearancePreferences>(() => {
    if (typeof window === 'undefined') return defaultAppearance
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return { ...defaultAppearance, ...JSON.parse(saved) }
      }
    } catch {
      // Fallback on storage errors
    }
    return defaultAppearance
  })

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.setAttribute('data-theme', appearance.theme)
    root.setAttribute('data-density', appearance.density)
    root.setAttribute('data-font-size', appearance.fontSize)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
    } catch {
      // ignore
    }
  }, [appearance])

  const updateAppearance = React.useCallback((updates: Partial<AppearancePreferences>) => {
    setAppearance((prev) => ({ ...prev, ...updates }))
  }, [])

  const resetAppearance = React.useCallback(() => {
    setAppearance(defaultAppearance)
  }, [])

  return (
    <AppearanceContext.Provider value={{ appearance, updateAppearance, resetAppearance }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  const ctx = React.useContext(AppearanceContext)
  if (!ctx) {
    return {
      appearance: defaultAppearance,
      updateAppearance: () => {},
      resetAppearance: () => {},
    }
  }
  return ctx
}
