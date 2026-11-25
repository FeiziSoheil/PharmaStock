/**
 * Primitive design tokens (raw immutable palette & numeric scales).
 * Components must consume semantic tokens rather than referencing primitives directly.
 */

export const primitiveColors = {
  white: '#ffffff',
  black: '#000000',

  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  teal: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#005c55',
    950: '#00504a',
  },

  clinicalTeal: {
    secondary: '#216963',
    secondaryContainer: '#a8ece5',
    secondaryOnContainer: '#266d68',
  },

  emerald: {
    50: '#ecfdf5',
    200: '#a7f3d0',
    600: '#059669',
    700: '#047857',
  },

  amber: {
    50: '#fffbeb',
    200: '#fde68a',
    600: '#d97706',
    700: '#b45309',
  },

  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    600: '#ea580c',
    700: '#c2410c',
  },

  rose: {
    50: '#fff1f2',
    200: '#fecdd3',
    600: '#e11d48',
    700: '#be123c',
  },

  sky: {
    50: '#eff6ff',
    200: '#bfdbfe',
    600: '#0284c7',
    700: '#0369a1',
  },

  alpha: {
    focusTeal12: 'rgba(15, 118, 110, 0.12)',
    focusTeal20: 'rgba(15, 118, 110, 0.2)',
    shadowSlate04: 'rgba(15, 23, 42, 0.04)',
    shadowSlate05: 'rgba(15, 23, 42, 0.05)',
    shadowSlate12: 'rgba(15, 23, 42, 0.12)',
    backdropSlate40: 'rgba(15, 23, 42, 0.4)',
    surfaceTranslucent95: 'rgba(255, 255, 255, 0.95)',
  },
} as const

export const primitiveFontFamilies = {
  sans: '"Vazirmatn Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif',
  latin: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as const

export const primitiveFontSizes = {
  '2xs': '0.6875rem', // 11px
  xs: '0.75rem', // 12px
  'sm-compact': '0.8125rem', // 13px
  sm: '0.875rem', // 14px
  'md-compact': '0.9375rem', // 15px
  base: '1rem', // 16px
  lg: '1.125rem', // 18px
  xl: '1.25rem', // 20px
  '2xl': '1.5rem', // 24px
  kpi: '1.75rem', // 28px
  '3xl': '2rem', // 32px
} as const

export const primitiveLineHeights = {
  none: '1',
  '2xs': '0.875rem', // 14px
  xs: '1rem', // 16px
  tight: '1.25rem', // 20px
  snug: '1.375rem', // 22px
  normal: '1.5rem', // 24px
  relaxed: '1.625rem', // 26px
  lg: '1.75rem', // 28px
  xl: '1.875rem', // 30px
  kpi: '2.125rem', // 34px
  '2xl': '2.25rem', // 36px
  '3xl': '2.75rem', // 44px
} as const

export const primitiveFontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

export const primitiveSpacing = {
  0: '0px',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
} as const

export const primitiveRadii = {
  none: '0px',
  4: '4px',
  6: '6px',
  8: '8px',
  10: '10px',
  12: '12px',
  16: '16px',
  full: '9999px',
} as const

export const primitiveElevation = {
  none: 'none',
  hairline: `0 1px 8px ${primitiveColors.alpha.shadowSlate04}`,
  ambient: `0 4px 12px ${primitiveColors.alpha.shadowSlate05}`,
  diffuse: `0 12px 32px ${primitiveColors.alpha.shadowSlate12}`,
} as const

export const primitiveLayout = {
  sidebarExpandedPx: 260,
  sidebarCollapsedPx: 72,
  headerHeightPx: 64,
  drawerWidthPx: 560,
  confirmDialogWidthPx: 420,
  shellInsetPx: 16,
  shellInsetMobilePx: 12,
  shellGapPx: 16,
  breakpoints: {
    tablet: 768,
    desktop: 1280,
  },
  zIndex: {
    base: 0,
    sticky: 20,
    header: 40,
    sidebar: 50,
    dropdown: 60,
    drawer: 70,
    modal: 80,
    toast: 90,
  },
} as const

export const primitives = {
  colors: primitiveColors,
  fontFamilies: primitiveFontFamilies,
  fontSizes: primitiveFontSizes,
  lineHeights: primitiveLineHeights,
  fontWeights: primitiveFontWeights,
  spacing: primitiveSpacing,
  radii: primitiveRadii,
  elevation: primitiveElevation,
  layout: primitiveLayout,
} as const
