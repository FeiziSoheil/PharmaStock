import type { MaterialSymbol } from 'material-symbols'

/**
 * 202 Stitch icon names that exist verbatim in `material-symbols@0.48.3`
 * (Material Symbols Outlined).
 */
export const DIRECT_STITCH_ICONS = [
  'ac_unit',
  'account_balance_wallet',
  'account_tree',
  'add',
  'add_box',
  'add_circle',
  'add_shopping_cart',
  'admin_panel_settings',
  'alarm',
  'analytics',
  'approval',
  'arrow_back',
  'arrow_downward',
  'arrow_forward',
  'arrow_left',
  'arrow_upward',
  'assignment_late',
  'assignment_return',
  'assignment_turned_in',
  'badge',
  'barcode',
  'barcode_reader',
  'barcode_scanner',
  'block',
  'bolt',
  'calendar_clock',
  'calendar_month',
  'calendar_today',
  'cell_tower',
  'check',
  'check_circle',
  'checklist_rtl',
  'chevron_left',
  'chevron_right',
  'clear_all',
  'clinical_notes',
  'close',
  'code',
  'content_copy',
  'countertops',
  'dangerous',
  'dashboard',
  'date_range',
  'delete',
  'delete_forever',
  'delete_sweep',
  'description',
  'difference',
  'domain',
  'domain_verification',
  'done_all',
  'download',
  'drafts',
  'e911_emergency',
  'edit',
  'edit_note',
  'emergency',
  'enhanced_encryption',
  'error',
  'event',
  'event_available',
  'event_busy',
  'event_note',
  'fact_check',
  'factory',
  'fiber_new',
  'filter_alt',
  'filter_alt_off',
  'fingerprint',
  'first_page',
  'format_image_left',
  'format_list_bulleted',
  'format_list_numbered',
  'gavel',
  'grid_goldenratio',
  'grid_view',
  'group',
  'history',
  'history_toggle_off',
  'hourglass_empty',
  'hourglass_top',
  'hub',
  'info',
  'input',
  'inventory',
  'inventory_2',
  'key',
  'keyboard_return',
  'kitchen',
  'label',
  'last_page',
  'layers',
  'library_add',
  'light_mode',
  'local_pharmacy',
  'local_shipping',
  'location_on',
  'lock',
  'lock_clock',
  'lock_person',
  'lock_reset',
  'login',
  'logout',
  'low_priority',
  'map',
  'medical_services',
  'medication',
  'medication_liquid',
  'menu_book',
  'mode_fan',
  'monitor_heart',
  'more_vert',
  'move_up',
  'near_me',
  'nest_clock_farsight_analog',
  'notification_important',
  'notifications',
  'notifications_active',
  'output',
  'output_circle',
  'payments',
  'pending_actions',
  'person',
  'person_add',
  'picture_as_pdf',
  'pill',
  'play_arrow',
  'playlist_add',
  'point_of_sale',
  'policy',
  'post_add',
  'prescriptions',
  'price_change',
  'price_check',
  'print',
  'priority_high',
  'production_quantity_limits',
  'progress_activity',
  'published_with_changes',
  'qr_code_2',
  'qr_code_scanner',
  'receipt',
  'receipt_long',
  'refresh',
  'remove',
  'replay',
  'reply',
  'reply_all',
  'restart_alt',
  'rule',
  'save',
  'save_clock',
  'schedule',
  'schedule_send',
  'science',
  'search',
  'search_check',
  'security',
  'send_and_archive',
  'sensors',
  'settings',
  'severe_cold',
  'shelves',
  'shield',
  'shield_person',
  'shield_with_heart',
  'shopping_cart_checkout',
  'show_chart',
  'skip_next',
  'sort',
  'store',
  'storefront',
  'swap_horiz',
  'swap_horizontal_circle',
  'swap_vert',
  'swap_vertical_circle',
  'sync',
  'sync_alt',
  'syringe',
  'table_view',
  'tag',
  'task_alt',
  'terminal',
  'thermostat',
  'timelapse',
  'timer',
  'token',
  'transfer_within_a_station',
  'trending_down',
  'trending_up',
  'tune',
  'unfold_more',
  'vaccines',
  'verified',
  'verified_user',
  'view_column',
  'view_list',
  'visibility',
  'warehouse',
  'warning',
  'water_drop',
  'west',
] as const satisfies readonly MaterialSymbol[]

export type DirectStitchIconName = (typeof DIRECT_STITCH_ICONS)[number]

export interface MissingIconMapping {
  readonly symbol: MaterialSymbol
  readonly filled?: boolean
  readonly reason: string
  readonly screens: readonly string[]
}

/**
 * 12 legacy Material Icons names used in Stitch exports that are absent from
 * `material-symbols@0.48.3` (`Material Symbols Outlined`), mapped to exact
 * Material Symbols equivalents while preserving original Stitch names as keys.
 */
export const MISSING_STITCH_ICON_MAPPINGS = {
  access_time_filled: {
    symbol: 'schedule',
    filled: true,
    reason: 'Legacy Material Icons filled clock variant; replaced by `schedule` with FILL=1.',
    screens: ['dashboard'],
  },
  announcement: {
    symbol: 'campaign',
    reason: 'Legacy Material Icons name; Material Symbols uses `campaign` for warning/alert announcements.',
    screens: ['dashboard-inventory'],
  },
  auto_awesome: {
    symbol: 'wand_stars',
    reason: 'Legacy Material Icons sparkle/AI icon; replaced by `wand_stars` in Material Symbols.',
    screens: ['auto-reorder-suggestions'],
  },
  auto_fix_high: {
    symbol: 'wand_shine',
    reason: 'Legacy Material Icons magic-wand auto-fill icon; replaced by `wand_shine` in Material Symbols.',
    screens: ['drug-catalog'],
  },
  do_not_disturb: {
    symbol: 'do_not_disturb_on',
    reason: 'Removed un-suffixed alias in Material Symbols; replaced by `do_not_disturb_on`.',
    screens: ['dashboard-inventory'],
  },
  done: {
    symbol: 'check',
    reason: 'Legacy Material Icons checkmark alias; Material Symbols standardizes on `check`.',
    screens: ['drug-details-cardex', 'periodic-stocktake'],
  },
  expand_less: {
    symbol: 'keyboard_arrow_up',
    reason: 'Legacy Material Icons chevron alias; replaced by `keyboard_arrow_up`.',
    screens: ['distributor-returns'],
  },
  expand_more: {
    symbol: 'keyboard_arrow_down',
    reason: 'Legacy Material Icons chevron alias (36 occurrences); replaced by `keyboard_arrow_down`.',
    screens: ['all-shell-headers-and-selects'],
  },
  file_download: {
    symbol: 'download',
    reason: 'Legacy Material Icons download alias; Material Symbols standardizes on `download`.',
    screens: ['audit-log', 'dashboard', 'drug-catalog'],
  },
  help_outline: {
    symbol: 'help',
    reason: 'Legacy outlined suffix removed in Material Symbols; `help` is already outlined by default.',
    screens: ['drug-details-cardex'],
  },
  new_releases: {
    symbol: 'release_alert',
    reason: 'Replaced in Material Symbols by `release_alert` for unmapped/new item alert badges.',
    screens: ['purchase-invoice-reconciliation'],
  },
  send_to_mobile: {
    symbol: 'mobile_share',
    reason: 'Legacy Material Icons mobile transfer icon; replaced by `mobile_share` for quick dispense action.',
    screens: ['dashboard-inventory'],
  },
} as const satisfies Record<string, MissingIconMapping>

export type LegacyStitchIconName = keyof typeof MISSING_STITCH_ICON_MAPPINGS

/** Complete union of all 214 unique Stitch icon names from `EXTRACTED.md`. */
export type StitchIconName = DirectStitchIconName | LegacyStitchIconName

export type IconName = StitchIconName | (MaterialSymbol & {})

export interface ResolvedIcon {
  readonly originalName: string
  readonly symbol: MaterialSymbol
  readonly filled: boolean
  readonly isMappedFallback: boolean
  readonly reason?: string
}

const directEntries = DIRECT_STITCH_ICONS.map(
  (name): [StitchIconName, ResolvedIcon] => [
    name,
    {
      originalName: name,
      symbol: name,
      filled: false,
      isMappedFallback: false,
    },
  ],
)

const mappedEntries = (
  Object.entries(MISSING_STITCH_ICON_MAPPINGS) as [LegacyStitchIconName, MissingIconMapping][]
).map(([name, mapping]): [StitchIconName, ResolvedIcon] => [
  name,
  {
    originalName: name,
    symbol: mapping.symbol,
    filled: Boolean(mapping.filled),
    isMappedFallback: true,
    reason: mapping.reason,
  },
])

/**
 * Centralized registry preserving all 214 Stitch icon names.
 */
export const STITCH_ICON_MAP: Record<StitchIconName, ResolvedIcon> = Object.fromEntries([
  ...directEntries,
  ...mappedEntries,
]) as Record<StitchIconName, ResolvedIcon>

/**
 * Semantic inventory triage status icons (paired with Persian text labels).
 */
export const STATUS_ICON_MAP = {
  valid: 'check_circle',
  warning: 'warning',
  expiring: 'schedule',
  critical: 'dangerous',
  info: 'info',
  neutral: 'inventory_2',
} as const satisfies Record<string, StitchIconName>

/**
 * Resolves a Stitch icon name (or Material Symbol name) to a verified
 * local Material Symbols Outlined ligature and variation configuration.
 */
export function resolveIcon(
  name: IconName | string,
  options?: { filled?: boolean },
): ResolvedIcon {
  const registered = (STITCH_ICON_MAP as Record<string, ResolvedIcon | undefined>)[name]
  if (registered) {
    return {
      ...registered,
      filled: options?.filled ?? registered.filled,
    }
  }

  return {
    originalName: name,
    symbol: (name || 'help') as MaterialSymbol,
    filled: options?.filled ?? false,
    isMappedFallback: false,
  }
}
