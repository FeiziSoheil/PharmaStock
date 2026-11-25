'use client'

import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'
import { AppShell } from './app-shell'

export type AppShellPageFallbackProps = {
  activeNavId?: AppNavId
  message?: string
}

/**
 * Suspense fallback for App Router pages that keep chrome (sidebar + header)
 * visible and only show loading inside the content island.
 */
function AppShellPageFallback({
  activeNavId,
  message = 'در حال بارگذاری…',
}: AppShellPageFallbackProps) {
  return (
    <AppShell
      navItems={getAppNavItems(activeNavId)}
      sidebar={{
        brand: {
          title: 'انبار دارو',
          subtitle: 'سامانه جامع موجودی داروخانه',
        },
      }}
      header={{
        branchLabel: 'داروخانه دکتر حسینی (مرکزی)',
        searchPlaceholder: 'جستجوی نام دارو، کد ژنریک، بارکد یا شناسه IRC...',
      }}
    >
      <div
        data-slot="app-shell-page-fallback"
        className="flex flex-1 flex-col gap-6 py-6"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded-default bg-surface-muted" />
            <div className="h-4 w-72 animate-pulse rounded-default bg-surface-muted" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-default bg-surface-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-default bg-surface-muted" />
          ))}
        </div>
        <div className="space-y-3 rounded-default border border-border-default bg-card p-6">
          <div className="h-10 w-full animate-pulse rounded-default bg-surface-muted" />
          <div className="h-12 w-full animate-pulse rounded-default bg-surface-muted" />
          <div className="h-12 w-full animate-pulse rounded-default bg-surface-muted" />
          <div className="h-12 w-full animate-pulse rounded-default bg-surface-muted" />
        </div>
        <p className="text-center text-body-sm text-text-secondary">
          {message}
        </p>
      </div>
    </AppShell>
  )
}

export { AppShellPageFallback }
