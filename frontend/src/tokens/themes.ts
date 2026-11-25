import { clinicalLightTokens, type ThemeTokens } from './semantic'

/**
 * Registered themes.
 * Architecture supports additional themes via `[data-theme="<id>"]` in CSS
 * and matching `ThemeTokens` objects here. Light-only in current scope.
 */
export const themes = {
  'clinical-light': clinicalLightTokens,
} as const satisfies Record<string, ThemeTokens>

export type ThemeId = keyof typeof themes

export const DEFAULT_THEME_ID: ThemeId = 'clinical-light'

export function getThemeTokens(themeId: ThemeId = DEFAULT_THEME_ID): ThemeTokens {
  return themes[themeId]
}
