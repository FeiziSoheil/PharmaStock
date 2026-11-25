'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  removeNotification,
  subscribeNotifications,
  type AppNotification,
  type NotificationCategory,
} from '@/lib/notifications'
import { toPersianDigits } from '@/lib/persian'
import { cn } from '@/lib/utils'

const EMPTY_NOTIFICATIONS: AppNotification[] = []

function getServerNotifications(): AppNotification[] {
  return EMPTY_NOTIFICATIONS
}

function getServerUnreadCount(): number {
  return 0
}

export function NotificationMenu({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<NotificationCategory>('all')

  let router: ReturnType<typeof useRouter> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch {
    // Graceful fallback for non-Next router test harnesses
  }

  const notifications = React.useSyncExternalStore(
    subscribeNotifications,
    getNotifications,
    getServerNotifications,
  )

  const unreadCount = React.useSyncExternalStore(
    subscribeNotifications,
    getUnreadCount,
    getServerUnreadCount,
  )

  const filteredNotifications = React.useMemo(() => {
    if (activeTab === 'all') return notifications
    return notifications.filter((item) => item.category === activeTab)
  }, [notifications, activeTab])

  const handleItemClick = (item: AppNotification) => {
    markNotificationAsRead(item.id)
    setOpen(false)
    if (router) {
      router.push(item.href)
    }
  }

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    removeNotification(id)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="اعلان‌ها"
          title="اعلان‌ها و هشدارها"
          data-slot="top-header-notifications"
          className={cn('relative', className)}
        >
          <Icon
            name={unreadCount > 0 ? 'notifications_active' : 'notifications'}
            size={20}
            data-slot="icon"
            className={unreadCount > 0 ? 'text-primary' : undefined}
          />
          {unreadCount > 0 ? (
            <span
              data-slot="notification-badge"
              className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-status-critical-fg text-[10px] font-bold text-white shadow-sm"
            >
              <span className="sr-only">اعلان جدید</span>
              {toPersianDigits(unreadCount > 9 ? '9+' : unreadCount)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 sm:w-96"
        data-slot="top-header-notifications-menu"
      >
        {/* Header */}
        <div className="border-b border-border-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-label-md font-semibold text-text-primary">
                اعلان‌ها و هشدارها
              </h3>
              {unreadCount > 0 ? (
                <Badge variant="critical" className="px-1.5 py-0 text-xs font-medium">
                  {toPersianDigits(unreadCount)} جدید
                </Badge>
              ) : null}
            </div>

            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-label-sm text-text-muted hover:text-text-primary"
                onClick={markAllNotificationsAsRead}
              >
                <Icon name="done_all" size={16} data-slot="icon" />
                خوانده شد
              </Button>
            ) : null}
          </div>

          {/* Filter Tabs */}
          <div className="mt-2.5 flex items-center gap-1 border-t border-border-subtle pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'rounded-default px-2.5 py-1 text-label-sm font-medium transition-colors',
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text-primary',
              )}
            >
              همه ({toPersianDigits(notifications.length)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('expiry')}
              className={cn(
                'rounded-default px-2.5 py-1 text-label-sm font-medium transition-colors',
                activeTab === 'expiry'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text-primary',
              )}
            >
              انقضا و FEFO
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reorder')}
              className={cn(
                'rounded-default px-2.5 py-1 text-label-sm font-medium transition-colors',
                activeTab === 'reorder'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text-primary',
              )}
            >
              کسری موجودی
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-text-muted">
              <Icon name="check_circle" size={32} className="mb-2 text-status-valid-fg" />
              <p className="text-body-sm font-medium">هیچ اعلان جدیدی وجود ندارد</p>
              <p className="text-label-sm text-text-muted">تمام هشدارهای انبار بررسی شده‌اند</p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const iconName =
                item.severity === 'critical'
                  ? 'error'
                  : item.severity === 'warning'
                    ? 'warning'
                    : 'info'
              const badgeVariant =
                item.severity === 'critical'
                  ? 'critical'
                  : item.severity === 'warning'
                    ? 'warning'
                    : 'info'

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleItemClick(item)
                    }
                  }}
                  className={cn(
                    'group relative flex cursor-pointer items-start gap-3 p-3 text-start transition-colors',
                    !item.read
                      ? 'bg-primary-tint/30 hover:bg-primary-tint/50'
                      : 'hover:bg-surface-hover',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full',
                      item.severity === 'critical' && 'bg-status-critical-bg text-status-critical-fg',
                      item.severity === 'warning' && 'bg-status-warning-bg text-status-warning-fg',
                      item.severity === 'info' && 'bg-status-info-bg text-status-info-fg',
                    )}
                  >
                    <Icon name={iconName} size={18} data-slot="icon" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-label-md font-medium text-text-primary">
                        {item.title}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => handleDismiss(e, item.id)}
                        className="opacity-0 transition-opacity hover:text-status-critical-fg group-hover:opacity-100"
                        title="حذف اعلان"
                        aria-label="حذف اعلان"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>

                    <p className="mt-0.5 line-clamp-2 text-label-sm text-text-muted">
                      {item.description}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between text-label-sm">
                      <span className="text-text-muted">{item.timestamp}</span>
                      <Badge variant={badgeVariant} className="px-1.5 py-0 text-[11px]">
                        {item.tagLabel}
                      </Badge>
                    </div>
                  </div>

                  {!item.read ? (
                    <span
                      aria-label="خوانده نشده"
                      className="absolute top-3 end-2 size-2 rounded-full bg-primary"
                    />
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-muted p-2">
          <Link
            href="/expiry-alerts-fefo"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-label-sm text-primary hover:underline"
          >
            پایش انقضا (FEFO)
          </Link>
          <Link
            href="/auto-reorder-suggestions"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-label-sm text-primary hover:underline"
          >
            سفارش مجدد (ROP)
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
