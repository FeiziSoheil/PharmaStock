export {
  primitives,
  primitiveColors,
  primitiveFontFamilies,
  primitiveFontSizes,
  primitiveLineHeights,
  primitiveFontWeights,
  primitiveSpacing,
  primitiveRadii,
  primitiveElevation,
  primitiveLayout,
} from './primitives'

export {
  clinicalLightTokens,
  type ThemeTokens,
  type StatusToneToken,
  type TypographyRoleToken,
} from './semantic'

export { themes, DEFAULT_THEME_ID, getThemeTokens, type ThemeId } from './themes'

/**
 * Canonical CSS custom property names exposed on `:root` / `[data-theme]`.
 */
export const CSS_TOKEN_VARS = {
  // Core surfaces & backgrounds
  bg: '--ps-bg',
  bgShell: '--ps-bg-shell',
  bgShellPattern: '--ps-bg-shell-pattern',
  surface: '--ps-surface',
  surfaceSubtle: '--ps-surface-subtle',
  surfaceMuted: '--ps-surface-muted',
  surfaceHover: '--ps-surface-hover',
  surfaceTranslucent: '--ps-surface-translucent',
  backdrop: '--ps-backdrop',

  // Text
  textPrimary: '--ps-text',
  textSecondary: '--ps-text-secondary',
  textMuted: '--ps-text-muted',
  textPlaceholder: '--ps-text-placeholder',
  textInverse: '--ps-text-inverse',

  // Borders
  border: '--ps-border',
  borderSubtle: '--ps-border-subtle',
  borderStrong: '--ps-border-strong',

  // Brand / Primary / Secondary
  primary: '--ps-primary',
  primaryHover: '--ps-primary-hover',
  primaryActive: '--ps-primary-active',
  primaryTint: '--ps-primary-tint',
  primaryBorder: '--ps-primary-border',
  primaryForeground: '--ps-primary-foreground',
  secondary: '--ps-secondary',
  secondaryTint: '--ps-secondary-tint',
  secondaryForeground: '--ps-secondary-foreground',

  // Focus
  focusBorder: '--ps-focus-border',
  focusRing: '--ps-focus-ring',
  focusRingShadow: '--ps-shadow-focus',

  // Status (Stitch preserved)
  statusValidFg: '--ps-status-valid-fg',
  statusValidBg: '--ps-status-valid-bg',
  statusValidBorder: '--ps-status-valid-border',
  statusWarningFg: '--ps-status-warning-fg',
  statusWarningBg: '--ps-status-warning-bg',
  statusWarningBorder: '--ps-status-warning-border',
  statusExpiringFg: '--ps-status-expiring-fg',
  statusExpiringBg: '--ps-status-expiring-bg',
  statusExpiringBorder: '--ps-status-expiring-border',
  statusCriticalFg: '--ps-status-critical-fg',
  statusCriticalBg: '--ps-status-critical-bg',
  statusCriticalBorder: '--ps-status-critical-border',
  statusInfoFg: '--ps-status-info-fg',
  statusInfoBg: '--ps-status-info-bg',
  statusInfoBorder: '--ps-status-info-border',
  statusNeutralFg: '--ps-status-neutral-fg',
  statusNeutralBg: '--ps-status-neutral-bg',
  statusNeutralBorder: '--ps-status-neutral-border',

  // Radii
  radiusNone: '--ps-radius-none',
  radiusCheckbox: '--ps-radius-checkbox',
  radiusInner: '--ps-radius-inner',
  radiusMd: '--ps-radius-md',
  radiusDefault: '--ps-radius-default',
  radiusLg: '--ps-radius-lg',
  radiusDialog: '--ps-radius-dialog',
  radiusPanel: '--ps-radius-panel',
  radiusBadge: '--ps-radius-badge',
  radiusFull: '--ps-radius-full',

  // Elevation
  shadowLevel0: '--ps-shadow-level-0',
  shadowLevel1: '--ps-shadow-level-1',
  shadowShell: '--ps-shadow-shell',
  shadowLevel2: '--ps-shadow-level-2',
  shadowLevel3: '--ps-shadow-level-3',

  // Layout
  sidebarWidth: '--ps-sidebar-width',
  sidebarCollapsedWidth: '--ps-sidebar-collapsed-width',
  headerHeight: '--ps-header-height',
  drawerWidth: '--ps-drawer-width',
  confirmDialogWidth: '--ps-confirm-dialog-width',
  shellInset: '--ps-shell-inset',
  shellInsetMobile: '--ps-shell-inset-mobile',
  shellGap: '--ps-shell-gap',
  tableRowHeight: '--ps-table-row-height',
  tableHeadHeight: '--ps-table-head-height',
  breakpointTablet: '--ps-breakpoint-tablet',
  breakpointDesktop: '--ps-breakpoint-desktop',
} as const
