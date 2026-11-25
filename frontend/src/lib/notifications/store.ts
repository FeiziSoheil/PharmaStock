import type { AppNotification } from './types'

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'انقضای بحرانی داروی آموکسی‌سیلین ۵۰۰',
    description: 'سری ساخت B2024 در قفسه A-02 کمتر از ۱۵ روز تا انقضا دارد.',
    timestamp: '۱۰ دقیقه پیش',
    category: 'expiry',
    severity: 'critical',
    tagLabel: 'بحرانی',
    href: '/expiry-alerts-fefo',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'کسری موجودی قرص سیتریزین ۱۰ م‌گ',
    description: 'موجودی فعلی (۴۰ بسته) به زیر نقطه سفارش مجدد (۱۰۰ بسته) رسیده است.',
    timestamp: '۱ ساعت پیش',
    category: 'reorder',
    severity: 'warning',
    tagLabel: 'سفارش مجدد',
    href: '/auto-reorder-suggestions',
    read: false,
  },
  {
    id: 'notif-3',
    title: 'تطبیق دفترچه داروهای مخدر',
    description: 'گردش شربت متادون ۵ در پایان شیفت نیازمند تایید مسئول فنی است.',
    timestamp: '۲ ساعت پیش',
    category: 'warehouse',
    severity: 'info',
    tagLabel: 'کنترل مخدر',
    href: '/controlled-substances-ledger',
    read: false,
  },
  {
    id: 'notif-4',
    title: 'انتقال به قرنطینه: ویال سفتریاکسون ۱ گرم',
    description: 'سری ساخت C991 به پایان تاریخ مصرف رسیده و باید به انبار ضایعات منتقل شود.',
    timestamp: 'امروز',
    category: 'expiry',
    severity: 'critical',
    tagLabel: 'منقضی شده',
    href: '/expiry-alerts-fefo',
    read: true,
  },
  {
    id: 'notif-5',
    title: 'تکمیل شمارش قفسه‌های سرم انبار',
    description: 'شمارش موجودی قفسه‌های منطقه Z-COLD تکمیل شده و آماده صدور سند تعدیل است.',
    timestamp: 'دیروز',
    category: 'warehouse',
    severity: 'info',
    tagLabel: 'انبارگردانی',
    href: '/periodic-stocktake',
    read: true,
  },
]

let notifications: AppNotification[] = [...INITIAL_NOTIFICATIONS]
const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

export function getNotifications(): AppNotification[] {
  return notifications
}

export function getUnreadCount(): number {
  return notifications.filter((n) => !n.read).length
}

export function markNotificationAsRead(id: string): void {
  let changed = false
  notifications = notifications.map((item) => {
    if (item.id === id && !item.read) {
      changed = true
      return { ...item, read: true }
    }
    return item
  })
  if (changed) {
    emitChange()
  }
}

export function markAllNotificationsAsRead(): void {
  let changed = false
  notifications = notifications.map((item) => {
    if (!item.read) {
      changed = true
      return { ...item, read: true }
    }
    return item
  })
  if (changed) {
    emitChange()
  }
}

export function removeNotification(id: string): void {
  const prevLen = notifications.length
  notifications = notifications.filter((item) => item.id !== id)
  if (notifications.length !== prevLen) {
    emitChange()
  }
}

export function addNotification(
  item: Omit<AppNotification, 'id' | 'read'> & { id?: string; read?: boolean },
): AppNotification {
  const newNotif: AppNotification = {
    id: item.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    read: item.read ?? false,
    ...item,
  }
  notifications = [newNotif, ...notifications]
  emitChange()
  return newNotif
}

export function subscribeNotifications(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetNotifications(): void {
  notifications = [...INITIAL_NOTIFICATIONS]
  emitChange()
}
