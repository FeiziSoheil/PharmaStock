'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  clearSession,
  getSessionUser,
  subscribeSession,
  type SessionUser,
} from '@/lib/api/session'
import { getAuditRoleLabel } from '@/lib/domain/auditEvents'
import { cn } from '@/lib/utils'

function firstInitial(name?: string): string {
  if (!name) return '؟'
  const trimmed = name.trim()
  if (!trimmed) return '؟'
  const runes = Array.from(trimmed)
  return runes[0] || '؟'
}

export function UserMenu({ className }: { className?: string }) {
  let router: ReturnType<typeof useRouter> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch {
    // Graceful fallback for non-Next router test harnesses
  }
  const [open, setOpen] = React.useState(false)

  // Hydration safety: server snapshot is null, client uses live session
  const user = React.useSyncExternalStore<SessionUser | null>(
    subscribeSession,
    () => getSessionUser(),
    () => null,
  )

  const handleLogout = React.useCallback(() => {
    setOpen(false)
    clearSession()
    router?.push('/login')
  }, [router])

  const initial = firstInitial(user?.name)
  const ariaLabel = user?.name || 'کاربر جاری'
  const roleLabel = user?.role ? getAuditRoleLabel(user.role) : 'کاربر سامانه'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="user-menu-trigger"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
            'bg-primary-tint text-label-md font-semibold text-primary',
            'transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            className,
          )}
        >
          <span>{initial}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-64 p-3 text-start"
        data-slot="user-menu-content"
      >
        <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-title-sm font-semibold text-primary">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-title-sm text-text-primary">
              {user?.name || 'کاربر سامانه'}
            </p>
            <p className="truncate text-label-sm text-text-muted">
              {roleLabel}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-text-primary"
            onClick={() => setOpen(false)}
          >
            <Link href="/profile">
              <Icon name="person" size={18} data-slot="icon" />
              <span>پروفایل من</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-status-critical-fg hover:bg-status-critical-bg hover:text-status-critical-fg"
            onClick={handleLogout}
          >
            <Icon name="logout" size={18} data-slot="icon" />
            <span>خروج از حساب</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
