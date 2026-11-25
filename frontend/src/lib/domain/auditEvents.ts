/**
 * Canonical audit action catalog for PharmaStock.
 * One typed source of truth: code + Persian label per action.
 */

export const AUDIT_ACTIONS = {
  login_success: {
    code: 'login_success',
    labelFa: 'ورود موفق',
    category: 'auth',
  },
  login_failure: {
    code: 'login_failure',
    labelFa: 'ورود ناموفق',
    category: 'auth',
  },
  login_lock: {
    code: 'login_lock',
    labelFa: 'قفل موقت حساب',
    category: 'auth',
  },
  profile_update: {
    code: 'profile_update',
    labelFa: 'ویرایش مشخصات فردی',
    category: 'access',
  },
  password_change: {
    code: 'password_change',
    labelFa: 'تغییر رمز عبور کاربر',
    category: 'access',
  },
  item_created: {
    code: 'item_created',
    labelFa: 'ثبت داروی جدید',
    category: 'catalog',
  },
  item_edited: {
    code: 'item_edited',
    labelFa: 'ویرایش مشخصات دارو',
    category: 'catalog',
  },
  shelf_move: {
    code: 'shelf_move',
    labelFa: 'جابجایی قفسه‌ای',
    category: 'inventory',
  },
  expiry_action_confirmed: {
    code: 'expiry_action_confirmed',
    labelFa: 'تایید اقدام انقضا',
    category: 'inventory',
  },
  reorder_drafted: {
    code: 'reorder_drafted',
    labelFa: 'پیش‌نویس سفارش کسری',
    category: 'inventory',
  },
  reorder_settings_updated: {
    code: 'reorder_settings_updated',
    labelFa: 'ویرایش فرمول نقطه سفارش (ROP)',
    category: 'inventory',
  },
  purchase_order_submitted: {
    code: 'purchase_order_submitted',
    labelFa: 'ثبت سفارش خرید از کسری',
    category: 'inbound',
  },
  purchase_order_status_updated: {
    code: 'purchase_order_status_updated',
    labelFa: 'تغییر وضعیت سفارش خرید',
    category: 'inbound',
  },
  stock_receipt: {
    code: 'stock_receipt',
    labelFa: 'تایید فاکتور ورودی',
    category: 'inbound',
  },
  /** Backend expiry/shelf CreateBatch audit code */
  stock_in: {
    code: 'stock_in',
    labelFa: 'ثبت سری ساخت جدید',
    category: 'inbound',
  },
  transfer: {
    code: 'transfer',
    labelFa: 'انتقال بین‌انباری',
    category: 'inventory',
  },
  /** Backend UpdateLocation audit code (shelf relocation) */
  stock_transfer: {
    code: 'stock_transfer',
    labelFa: 'جابجایی قفسه',
    category: 'inventory',
  },
  dispensing: {
    code: 'dispensing',
    labelFa: 'نسخه‌پیچی و ترخیص',
    category: 'outbound',
  },
  controlled_dispense: {
    code: 'controlled_dispense',
    labelFa: 'نسخه‌پیچی داروی مخدر',
    category: 'controlled',
  },
  return_to_distributor: {
    code: 'return_to_distributor',
    labelFa: 'مرجوعی به پخش',
    category: 'outbound',
  },
  stocktake_adjust: {
    code: 'stocktake_adjust',
    labelFa: 'تعدیل انبارگردانی',
    category: 'inventory',
  },
  role_change: {
    code: 'role_change',
    labelFa: 'تغییر نقش دسترسی',
    category: 'access',
  },
  controlled_substance_entry: {
    code: 'controlled_substance_entry',
    labelFa: 'ثبت ورود داروی تحت کنترل',
    category: 'controlled',
  },
  price_mod: {
    code: 'price_mod',
    labelFa: 'ویرایش نرخ مصوب',
    category: 'pricing',
  },
  quarantine: {
    code: 'quarantine',
    labelFa: 'قرنطینه / توقف فروش',
    category: 'inventory',
  },
  unknown: {
    code: 'unknown',
    labelFa: 'عملیات نامشخص',
    category: 'inventory',
  },
} as const

export type AuditActionCode = keyof typeof AUDIT_ACTIONS

export type AuditActionCategory =
  (typeof AUDIT_ACTIONS)[AuditActionCode]['category']

export const AUDIT_ACTION_CODES = Object.keys(
  AUDIT_ACTIONS,
) as AuditActionCode[]

export function isAuditActionCode(value: string): value is AuditActionCode {
  return value in AUDIT_ACTIONS
}

export function resolveAuditActionCode(code: string): AuditActionCode {
  return isAuditActionCode(code) ? code : 'unknown'
}

export function getAuditActionLabel(code: string): string {
  return AUDIT_ACTIONS[resolveAuditActionCode(code)].labelFa
}

export function isControlledAuditAction(code: string): boolean {
  return AUDIT_ACTIONS[resolveAuditActionCode(code)].category === 'controlled'
}

/** Stitch filter buckets mapped onto one or more action codes. */
export const AUDIT_ACTION_FILTER_GROUPS = {
  all: { labelFa: 'همه رخدادها', codes: null },
  controlled: {
    labelFa: 'نسخه‌پیچی مخدر / سهمیه‌ای',
    codes: ['controlled_dispense', 'controlled_substance_entry'] as const,
  },
  stock_adjust: {
    labelFa: 'تعدیل موجودی و انبارگردانی',
    codes: ['stocktake_adjust', 'shelf_move', 'quarantine'] as const,
  },
  price_mod: {
    labelFa: 'ویرایش قیمت مصوب بیمه‌ای',
    codes: ['price_mod'] as const,
  },
  invoice_receipt: {
    labelFa: 'ثبت و تایید فاکتور ورودی',
    codes: ['stock_receipt', 'stock_in'] as const,
  },
  batch_transfer: {
    labelFa: 'انتقال بین‌انباری بچ دارو',
    codes: ['transfer', 'shelf_move', 'stock_transfer'] as const,
  },
  auth_event: {
    labelFa: 'ورود / خروج امنیتی پرسنل',
    codes: ['login_success', 'login_failure', 'login_lock'] as const,
  },
} as const

export type AuditActionFilterGroup = keyof typeof AUDIT_ACTION_FILTER_GROUPS

export const AUDIT_ENTITY_TYPES = {
  batch: { code: 'batch', labelFa: 'کاردکس و پارت‌نامبر بچ' },
  narcotic_book: { code: 'narcotic_book', labelFa: 'دفترچه نظارت مخدر (IRC)' },
  pricing: { code: 'pricing', labelFa: 'تعرفه و قیمت‌گذاری دارو' },
  invoice: { code: 'invoice', labelFa: 'فاکتور خرید پخش' },
  outbound: { code: 'outbound', labelFa: 'حواله ترخیص و خروج' },
  /** Backend dispensing confirm entity type */
  dispense: { code: 'dispense', labelFa: 'نسخه‌پیچی و ترخیص' },
  /** Backend internal transfer confirm entity type */
  transfer: { code: 'transfer', labelFa: 'حواله انتقال داخلی' },
  /** Backend periodic stocktake confirm entity type */
  stocktake: { code: 'stocktake', labelFa: 'انبارگردانی دوره‌ای' },
  /** Backend distributor return slip entity type */
  return: { code: 'return', labelFa: 'برگه مرجوعی به پخش' },
  user_access: { code: 'user_access', labelFa: 'پروفایل و دسترسی پرسنل' },
  /** Backend auth login entity type */
  user: { code: 'user', labelFa: 'حساب کاربری' },
  drug: { code: 'drug', labelFa: 'کاتالوگ دارو' },
  shelf: { code: 'shelf', labelFa: 'قفسه و موقعیت فیزیکی' },
  session: { code: 'session', labelFa: 'نشست امنیتی' },
  /** Backend reorder draft entity type */
  purchase_draft: { code: 'purchase_draft', labelFa: 'پیش‌نویس سفارش کسری' },
  purchase_order: { code: 'purchase_order', labelFa: 'سفارش خرید' },
  reorder_settings: { code: 'reorder_settings', labelFa: 'تنظیمات فرمول ROP' },
  unknown: { code: 'unknown', labelFa: 'موجودیت نامشخص' },
} as const

export type AuditEntityType = keyof typeof AUDIT_ENTITY_TYPES

export function isAuditEntityType(value: string): value is AuditEntityType {
  return value in AUDIT_ENTITY_TYPES
}

export function resolveAuditEntityType(value: string): AuditEntityType {
  return isAuditEntityType(value) ? value : 'unknown'
}

export function getAuditEntityTypeLabel(value: string): string {
  return AUDIT_ENTITY_TYPES[resolveAuditEntityType(value)].labelFa
}

export const AUDIT_SEVERITIES = {
  info: { code: 'info', labelFa: 'اطلاع', icon: 'info' },
  warning: { code: 'warning', labelFa: 'هشدار', icon: 'warning' },
  critical: { code: 'critical', labelFa: 'بحرانی', icon: 'error' },
} as const

export type AuditSeverity = keyof typeof AUDIT_SEVERITIES

export const AUDIT_SOURCES = {
  ui: { code: 'ui', labelFa: 'رابط کاربری' },
  system: { code: 'system', labelFa: 'سامانه خودکار' },
  seed: { code: 'seed', labelFa: 'داده اولیه' },
  api: { code: 'api', labelFa: 'API' },
  unknown: { code: 'unknown', labelFa: 'مبدأ نامشخص' },
} as const

export type AuditSource = keyof typeof AUDIT_SOURCES

export function isAuditSource(value: string): value is AuditSource {
  return value in AUDIT_SOURCES
}

export function resolveAuditSource(value: string): AuditSource {
  return isAuditSource(value) ? value : 'unknown'
}

export function getAuditSourceLabel(value: string): string {
  return AUDIT_SOURCES[resolveAuditSource(value)].labelFa
}

export const AUDIT_ROLES = {
  super_admin: { code: 'super_admin', labelFa: 'مدیر سامانه / مؤسس' },
  technical_officer: { code: 'technical_officer', labelFa: 'مسئول فنی' },
  warehouse_lead: { code: 'warehouse_lead', labelFa: 'سرپرست انبار' },
  warehouse_operator: { code: 'warehouse_operator', labelFa: 'اپراتور انبار' },
  dispensing_clerk: { code: 'dispensing_clerk', labelFa: 'متصدی نسخه و پیشخوان' },
  intake_clerk: { code: 'intake_clerk', labelFa: 'متصدی پذیرش' },
  pharmacist: { code: 'pharmacist', labelFa: 'داروساز' },
  system: { code: 'system', labelFa: 'فرآیند خودکار سامانه' },
  unknown: { code: 'unknown', labelFa: 'نامشخص' },
} as const

export type AuditRole = keyof typeof AUDIT_ROLES

export function isAuditRole(value: string): value is AuditRole {
  return value in AUDIT_ROLES
}

export function resolveAuditRole(role: string): AuditRole {
  return isAuditRole(role) ? role : 'unknown'
}

export function getAuditRoleLabel(role: string): string {
  return AUDIT_ROLES[resolveAuditRole(role)].labelFa
}
