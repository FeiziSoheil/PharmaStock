import { primitives } from './primitives'

/**
 * Semantic theme contract for PharmaStock.
 * Future themes (when introduced) must implement this exact structural contract
 * without altering component contracts.
 */
export interface StatusToneToken {
  readonly foreground: string
  readonly background: string
  readonly border: string
}

export interface TypographyRoleToken {
  readonly fontFamily: string
  readonly fontSize: string
  readonly lineHeight: string
  readonly fontWeight: number
  readonly letterSpacing?: string
}

export interface ThemeTokens {
  readonly id: string
  readonly colorScheme: 'light'
  readonly colors: {
    readonly background: string
    /** Full-page floating-shell canvas gradient (applied with pattern via `.bg-shell`). */
    readonly backgroundShell: string
    /** Low-contrast dot-grid overlay for the floating-shell canvas. */
    readonly backgroundShellPattern: string
    readonly surface: string
    readonly surfaceSubtle: string
    readonly surfaceMuted: string
    readonly surfaceHover: string
    readonly surfaceTranslucent: string
    readonly backdrop: string
    readonly text: {
      readonly primary: string
      readonly secondary: string
      readonly muted: string
      readonly placeholder: string
      readonly inverse: string
    }
    readonly border: {
      readonly default: string
      readonly subtle: string
      readonly strong: string
    }
    readonly primary: {
      readonly default: string
      readonly hover: string
      readonly active: string
      readonly tint: string
      readonly border: string
      readonly foreground: string
    }
    readonly secondary: {
      readonly default: string
      readonly tint: string
      readonly foreground: string
    }
    readonly focus: {
      readonly border: string
      readonly ring: string
      readonly ringWidth: string
    }
    /** Preserved Stitch inventory triage & semantic status tiers */
    readonly status: {
      readonly valid: StatusToneToken
      readonly warning: StatusToneToken
      readonly expiring: StatusToneToken
      readonly critical: StatusToneToken
      readonly info: StatusToneToken
      readonly neutral: StatusToneToken
    }
  }
  readonly typography: {
    readonly families: {
      readonly sans: string
      readonly latin: string
      readonly mono: string
    }
    readonly roles: {
      readonly headlineXl: TypographyRoleToken
      readonly headlineLg: TypographyRoleToken
      readonly headlineMd: TypographyRoleToken
      readonly headlineSm: TypographyRoleToken
      readonly titleMd: TypographyRoleToken
      readonly titleSm: TypographyRoleToken
      readonly bodyLg: TypographyRoleToken
      readonly bodyMd: TypographyRoleToken
      readonly bodySm: TypographyRoleToken
      readonly labelLg: TypographyRoleToken
      readonly labelMd: TypographyRoleToken
      readonly labelSm: TypographyRoleToken
      readonly kpi: TypographyRoleToken
      readonly dataTabular: TypographyRoleToken
    }
  }
  readonly spacing: {
    readonly xs: string
    readonly sm: string
    readonly md: string
    readonly lg: string
    readonly xl: string
    readonly gutter: string
    readonly gutterLg: string
    readonly margin: string
    readonly marginMobile: string
    readonly cellY: string
    readonly cellX: string
    readonly tableRowHeight: string
    readonly tableHeadHeight: string
  }
  readonly radius: {
    readonly none: string
    readonly checkbox: string
    readonly inner: string
    readonly md: string
    readonly default: string
    readonly lg: string
    readonly dialog: string
    /** Floating shell islands (sidebar / navbar / content). */
    readonly panel: string
    readonly badge: string
    readonly full: string
  }
  readonly elevation: {
    readonly level0: string
    readonly level1: string
    readonly shell: string
    readonly level2: string
    readonly level3: string
    readonly focusRing: string
  }
  readonly layout: {
    readonly sidebarWidth: string
    readonly sidebarCollapsedWidth: string
    readonly headerHeight: string
    readonly drawerWidth: string
    readonly confirmDialogWidth: string
    readonly shellInset: string
    readonly shellInsetMobile: string
    readonly shellGap: string
    readonly breakpoints: {
      readonly tablet: string
      readonly desktop: string
    }
    readonly zIndex: typeof primitives.layout.zIndex
  }
}

/**
 * Canonical light theme ("Clinical Minimal RTL").
 * Combines canonical clinical Slate + Teal 700 core palette with
 * preserved Stitch inventory triage status tokens.
 */
export const clinicalLightTokens: ThemeTokens = {
  id: 'clinical-light',
  colorScheme: 'light',
  colors: {
    background: primitives.colors.slate[50], // #f8fafc
    backgroundShell:
      'linear-gradient(160deg, #f8fafc 0%, #f0fdfa 55%, #f8fafc 100%)',
    backgroundShellPattern:
      'radial-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px)',
    surface: primitives.colors.white, // #ffffff
    surfaceSubtle: primitives.colors.slate[100], // #f1f5f9
    surfaceMuted: primitives.colors.slate[50], // #f8fafc
    surfaceHover: primitives.colors.teal[50], // #f0fdfa
    surfaceTranslucent: primitives.colors.alpha.surfaceTranslucent95,
    backdrop: primitives.colors.alpha.backdropSlate40,
    text: {
      primary: primitives.colors.slate[900], // #0f172a
      secondary: primitives.colors.slate[600], // #475569
      muted: primitives.colors.slate[500], // #64748b (WCAG AA readable muted copy)
      placeholder: primitives.colors.slate[400], // #94a3b8 (placeholders & disabled)
      inverse: primitives.colors.white, // #ffffff
    },
    border: {
      default: primitives.colors.slate[200], // #e2e8f0
      subtle: primitives.colors.slate[100], // #f1f5f9
      strong: primitives.colors.slate[300], // #cbd5e1
    },
    primary: {
      default: primitives.colors.teal[700], // #0f766e
      hover: primitives.colors.teal[800], // #115e59
      active: primitives.colors.teal[900], // #005c55 (preserved deep teal)
      tint: primitives.colors.teal[50], // #f0fdfa
      border: primitives.colors.teal[200], // #99f6e4
      foreground: primitives.colors.white, // #ffffff
    },
    secondary: {
      default: primitives.colors.clinicalTeal.secondary, // #216963
      tint: primitives.colors.teal[100], // #ccfbf1
      foreground: primitives.colors.white,
    },
    focus: {
      border: primitives.colors.teal[700], // #0f766e
      ring: primitives.colors.alpha.focusTeal12, // rgba(15, 118, 110, 0.12)
      ringWidth: '3px',
    },
    status: {
      valid: {
        foreground: primitives.colors.emerald[600], // #059669
        background: primitives.colors.emerald[50], // #ecfdf5
        border: primitives.colors.emerald[200], // #a7f3d0
      },
      warning: {
        foreground: primitives.colors.amber[600], // #d97706
        background: primitives.colors.amber[50], // #fffbeb
        border: primitives.colors.amber[200], // #fde68a
      },
      expiring: {
        foreground: primitives.colors.orange[600], // #ea580c
        background: primitives.colors.orange[50], // #fff7ed
        border: primitives.colors.orange[100], // #ffedd5
      },
      critical: {
        foreground: primitives.colors.rose[600], // #e11d48
        background: primitives.colors.rose[50], // #fff1f2
        border: primitives.colors.rose[200], // #fecdd3
      },
      info: {
        foreground: primitives.colors.sky[600], // #0284c7
        background: primitives.colors.sky[50], // #eff6ff
        border: primitives.colors.sky[200], // #bfdbfe
      },
      neutral: {
        foreground: primitives.colors.slate[600], // #475569
        background: primitives.colors.slate[100], // #f1f5f9
        border: primitives.colors.slate[200], // #e2e8f0
      },
    },
  },
  typography: {
    families: {
      sans: primitives.fontFamilies.sans,
      latin: primitives.fontFamilies.latin,
      mono: primitives.fontFamilies.mono,
    },
    roles: {
      headlineXl: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes['3xl'],
        lineHeight: primitives.lineHeights['3xl'],
        fontWeight: primitives.fontWeights.bold,
        letterSpacing: '-0.02em',
      },
      headlineLg: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes['2xl'],
        lineHeight: primitives.lineHeights['2xl'],
        fontWeight: primitives.fontWeights.bold,
        letterSpacing: '-0.01em',
      },
      headlineMd: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.xl,
        lineHeight: primitives.lineHeights.xl,
        fontWeight: primitives.fontWeights.semibold,
      },
      headlineSm: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.lg,
        lineHeight: primitives.lineHeights.lg,
        fontWeight: primitives.fontWeights.semibold,
      },
      titleMd: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.base,
        lineHeight: primitives.lineHeights.normal,
        fontWeight: primitives.fontWeights.semibold,
      },
      titleSm: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes['md-compact'],
        lineHeight: primitives.lineHeights.normal,
        fontWeight: primitives.fontWeights.semibold,
      },
      bodyLg: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.base,
        lineHeight: primitives.lineHeights.relaxed,
        fontWeight: primitives.fontWeights.regular,
      },
      bodyMd: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.sm,
        lineHeight: primitives.lineHeights.snug,
        fontWeight: primitives.fontWeights.regular,
      },
      bodySm: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes['sm-compact'],
        lineHeight: primitives.lineHeights.tight,
        fontWeight: primitives.fontWeights.regular,
      },
      labelLg: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.sm,
        lineHeight: primitives.lineHeights.snug,
        fontWeight: primitives.fontWeights.semibold,
      },
      labelMd: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.xs,
        lineHeight: primitives.lineHeights.xs,
        fontWeight: primitives.fontWeights.medium,
      },
      labelSm: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes['2xs'],
        lineHeight: primitives.lineHeights['2xs'],
        fontWeight: primitives.fontWeights.medium,
      },
      kpi: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.kpi,
        lineHeight: primitives.lineHeights.kpi,
        fontWeight: primitives.fontWeights.bold,
      },
      dataTabular: {
        fontFamily: primitives.fontFamilies.sans,
        fontSize: primitives.fontSizes.sm,
        lineHeight: primitives.lineHeights.tight,
        fontWeight: primitives.fontWeights.medium,
      },
    },
  },
  spacing: {
    xs: primitives.spacing[1], // 4px
    sm: primitives.spacing[2], // 8px
    md: primitives.spacing[4], // 16px
    lg: primitives.spacing[6], // 24px
    xl: primitives.spacing[8], // 32px
    gutter: primitives.spacing[4], // 16px
    gutterLg: primitives.spacing[6], // 24px
    margin: primitives.spacing[6], // 24px
    marginMobile: primitives.spacing[4], // 16px
    cellY: 'calc(0.5rem + 2px)', // DESIGN.md tabular vertical rhythm (8px + 2px optical allowance)
    cellX: primitives.spacing[4], // 16px
    tableRowHeight: '48px', // DESIGN.md: row height capped at 48px
    tableHeadHeight: '44px',
  },
  radius: {
    none: primitives.radii.none,
    checkbox: primitives.radii[4], // 4px
    inner: primitives.radii[6], // 6px
    md: primitives.radii[8], // 8px
    default: primitives.radii[10], // 10px
    lg: primitives.radii[12], // 12px
    dialog: primitives.radii[16], // 16px (per DESIGN.md Large Radius for dialogs)
    panel: primitives.radii[16], // 16px floating shell islands
    badge: primitives.radii.full, // 9999px
    full: primitives.radii.full, // 9999px
  },
  elevation: {
    level0: primitives.elevation.none,
    /** Card / section containers: soft 1px border (`border.default`), no drop shadow. */
    level1: primitives.elevation.none,
    shell: primitives.elevation.hairline,
    level2: primitives.elevation.ambient,
    level3: primitives.elevation.diffuse,
    focusRing: `0 0 0 3px ${primitives.colors.alpha.focusTeal12}`,
  },
  layout: {
    sidebarWidth: `${primitives.layout.sidebarExpandedPx}px`,
    sidebarCollapsedWidth: `${primitives.layout.sidebarCollapsedPx}px`,
    headerHeight: `${primitives.layout.headerHeightPx}px`,
    drawerWidth: `${primitives.layout.drawerWidthPx}px`,
    confirmDialogWidth: `${primitives.layout.confirmDialogWidthPx}px`,
    shellInset: `${primitives.layout.shellInsetPx}px`,
    shellInsetMobile: `${primitives.layout.shellInsetMobilePx}px`,
    shellGap: `${primitives.layout.shellGapPx}px`,
    breakpoints: {
      tablet: `${primitives.layout.breakpoints.tablet}px`,
      desktop: `${primitives.layout.breakpoints.desktop}px`,
    },
    zIndex: primitives.layout.zIndex,
  },
}
