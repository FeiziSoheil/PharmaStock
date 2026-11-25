export type NotificationCategory = 'all' | 'expiry' | 'reorder' | 'warehouse'

export type NotificationSeverity = 'critical' | 'warning' | 'info'

export type AppNotification = {
  id: string
  title: string
  description: string
  timestamp: string
  category: 'expiry' | 'reorder' | 'warehouse'
  severity: NotificationSeverity
  tagLabel: string
  href: string
  read: boolean
}
