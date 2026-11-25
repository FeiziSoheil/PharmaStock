import type { SidebarNavItem } from '@/components/layout'

export type AppNavId =
  | 'dashboard'
  | 'dashboard-inventory'
  | 'catalog'
  | 'drug-details'
  | 'shelf'
  | 'receipts'
  | 'purchase-reconciliation'
  | 'dispensing'
  | 'internal-transfer'
  | 'periodic-stocktake'
  | 'alerts'
  | 'reorder'
  | 'distributor-returns'
  | 'controlled-substances'
  | 'audit-log'
  | 'users-permissions'
  | 'settings'

/**
 * Canonical sidebar links for implemented PharmaStock routes.
 * Pass `activeId` from the current screen so the correct item is highlighted.
 * Dev galleries (`/domain`, `/components`, `/tokens`) stay reachable by URL but are omitted from the panel.
 */
export function getAppNavItems(activeId?: AppNavId): SidebarNavItem[] {
  const items: Array<Omit<SidebarNavItem, 'active'> & { id: AppNavId }> = [
    // دسته ۱: پیشخوان و آمار
    {
      id: 'dashboard',
      label: 'داشبورد و آمار',
      href: '/dashboard',
      icon: 'dashboard',
      section: 'پیشخوان و آمار',
    },
    {
      id: 'dashboard-inventory',
      label: 'داشبورد و موجودی انبار',
      href: '/dashboard-inventory',
      icon: 'inventory',
      section: 'پیشخوان و آمار',
    },

    // دسته ۲: اطلاعات دارویی و انبارداری پایه
    {
      id: 'catalog',
      label: 'کاتالوگ دارو',
      href: '/drug-catalog',
      icon: 'menu_book',
      section: 'اطلاعات پایه و کاتالوگ',
    },
    {
      id: 'drug-details',
      label: 'جزئیات دارو و کاردکس',
      href: '/drug-details-cardex?drugId=drug-amox',
      icon: 'medication',
      section: 'اطلاعات پایه و کاتالوگ',
    },
    {
      id: 'shelf',
      label: 'موجودی فیزیکی قفسه‌ها',
      href: '/shelf-inventory',
      icon: 'warehouse',
      section: 'اطلاعات پایه و کاتالوگ',
    },

    // دسته ۳: ورود و خروج کالا (عملیات انبار)
    {
      id: 'receipts',
      label: 'ورود فاکتور و رسید انبار',
      href: '/invoice-receipts',
      icon: 'receipt_long',
      section: 'ورود و خروج کالا',
    },
    {
      id: 'purchase-reconciliation',
      label: 'فاکتور خرید (اکسل و تطبیق)',
      href: '/purchase-invoice-reconciliation',
      icon: 'fact_check',
      section: 'ورود و خروج کالا',
    },
    {
      id: 'dispensing',
      label: 'حواله خروج و فروش',
      href: '/dispensing-dispatch',
      icon: 'local_shipping',
      section: 'ورود و خروج کالا',
    },
    {
      id: 'internal-transfer',
      label: 'انتقال داخلی',
      href: '/internal-transfer',
      icon: 'swap_horiz',
      section: 'ورود و خروج کالا',
    },
    {
      id: 'distributor-returns',
      label: 'مرجوعی به شرکت‌های پخش',
      href: '/distributor-returns',
      icon: 'assignment_return',
      section: 'ورود و خروج کالا',
    },

    // دسته ۴: کنترل کیفیت و زنجیره تأمین
    {
      id: 'alerts',
      label: 'هشدارهای انقضا و FEFO',
      href: '/expiry-alerts-fefo',
      icon: 'notification_important',
      section: 'کنترل کیفیت و زنجیره تأمین',
    },
    {
      id: 'reorder',
      label: 'پیشنهاد سفارش خودکار',
      href: '/auto-reorder-suggestions',
      icon: 'auto_awesome',
      section: 'کنترل کیفیت و زنجیره تأمین',
    },
    {
      id: 'periodic-stocktake',
      label: 'انبارگردانی دوره‌ای',
      href: '/periodic-stocktake',
      icon: 'fact_check',
      section: 'کنترل کیفیت و زنجیره تأمین',
    },
    {
      id: 'controlled-substances',
      label: 'دفترچه داروهای تحت کنترل و مخدر',
      href: '/controlled-substances-ledger',
      icon: 'enhanced_encryption',
      section: 'کنترل کیفیت و زنجیره تأمین',
    },

    // دسته ۵: نظارت و سیستم
    {
      id: 'audit-log',
      label: 'گزارش و لاگ ممیزی',
      href: '/audit-log',
      icon: 'policy',
      section: 'نظارت و سیستم',
    },
    {
      id: 'users-permissions',
      label: 'مدیریت کاربران و دسترسی‌ها',
      href: '/users-permissions',
      icon: 'admin_panel_settings',
      section: 'نظارت و سیستم',
    },
    {
      id: 'settings',
      label: 'تنظیمات سیستم',
      href: '/settings',
      icon: 'tune',
      section: 'نظارت و سیستم',
    },
  ]

  return items.map((item) => ({
    ...item,
    active: activeId !== undefined && item.id === activeId,
  }))
}
