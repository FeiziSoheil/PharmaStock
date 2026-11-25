'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useLayoutMode } from '@/hooks/use-breakpoint'
import { cn } from '@/lib/utils'
import {
  ShellDrawerContext,
  type ShellDrawerPayload,
} from './shell-drawer-context'
import { Sidebar, type SidebarNavItem, type SidebarProps } from './sidebar'
import { TopHeader, type TopHeaderProps } from './top-header'

export type AppShellProps = {
  navItems: SidebarNavItem[]
  children: React.ReactNode
  /** Desktop-only initial collapse preference. Tablet always collapses. */
  defaultCollapsed?: boolean
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  header?: Omit<TopHeaderProps, 'showMenuButton' | 'onMenuClick'>
  sidebar?: Pick<SidebarProps, 'brand' | 'footer'>
  className?: string
  contentClassName?: string
}

const islandChrome =
  'overflow-hidden border border-border-default bg-surface rounded-panel'

const slideEase =
  'duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none'

const SIDEBAR_COLLAPSED_KEY = 'pharmastock_sidebar_collapsed'
const sidebarCollapsedListeners = new Set<() => void>()

function subscribeSidebarCollapsed(listener: () => void) {
  sidebarCollapsedListeners.add(listener)
  if (typeof window === 'undefined') {
    return () => {
      sidebarCollapsedListeners.delete(listener)
    }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_KEY || event.key === null) {
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    sidebarCollapsedListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSidebarCollapsedSnapshot(defaultVal: boolean): boolean {
  if (typeof window === 'undefined') return defaultVal
  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved !== null) return saved === 'true'
  } catch {
    // ignore
  }
  return defaultVal
}

function getServerSidebarCollapsed(defaultVal: boolean): boolean {
  return defaultVal
}

function setPersistedSidebarCollapsed(next: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
  } catch {
    // ignore
  }
  for (const listener of sidebarCollapsedListeners) {
    listener()
  }
}

/**
 * Floating chrome: canvas + islands.
 * Desktop/tablet columns: sidebar | main (header+content) | push drawer (when open).
 * Mobile: floating header+content; nav via Sheet; drawers overlay via SideDrawer Sheet.
 */
function AppShell({
  navItems,
  children,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onCollapsedChange,
  header,
  sidebar,
  className,
  contentClassName,
}: AppShellProps) {
  const mode = useLayoutMode('desktop')
  const persistedCollapsed = React.useSyncExternalStore(
    subscribeSidebarCollapsed,
    () => getSidebarCollapsedSnapshot(defaultCollapsed),
    () => getServerSidebarCollapsed(defaultCollapsed),
  )
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [drawer, setDrawer] = React.useState<ShellDrawerPayload | null>(null)

  const isControlled = collapsedProp !== undefined
  const userCollapsed = isControlled ? collapsedProp : persistedCollapsed

  const setCollapsed = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setPersistedSidebarCollapsed(next)
      }
      onCollapsedChange?.(next)
    },
    [isControlled, onCollapsedChange],
  )

  const collapsed =
    mode === 'tablet' ? true : mode === 'desktop' ? userCollapsed : false

  const mobileNavOpen = mode === 'mobile' && mobileOpen
  const pushEnabled = mode !== 'mobile'
  const drawerOpen = Boolean(pushEnabled && drawer?.open)

  const handleNavigate = React.useCallback(() => {
    setMobileOpen(false)
  }, [])

  const publishDrawer = React.useCallback((payload: ShellDrawerPayload | null) => {
    setDrawer(payload)
  }, [])

  const drawerHost = React.useMemo(
    () => ({
      pushEnabled,
      publish: publishDrawer,
    }),
    [pushEnabled, publishDrawer],
  )

  React.useEffect(() => {
    if (!drawerOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        drawer?.onOpenChange?.(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, drawer])

  return (
    <ShellDrawerContext.Provider value={drawerHost}>
      <div
        data-slot="app-shell"
        data-layout-mode={mode}
        data-sidebar-collapsed={collapsed ? 'true' : 'false'}
        data-drawer-open={drawerOpen ? 'true' : 'false'}
        className={cn(
          'bg-shell flex h-dvh flex-col overflow-hidden p-shell-inset-mobile tablet:p-shell-inset',
          className,
        )}
      >
        {mode === 'mobile' ? (
          <Sheet
            open={mobileNavOpen}
            onOpenChange={(open) => {
              if (mode === 'mobile') setMobileOpen(open)
            }}
          >
            <SheetContent
              side="start"
              showCloseButton
              className="w-[min(100%,var(--ps-sidebar-width))] p-0 sm:max-w-[var(--ps-sidebar-width)]"
              data-slot="app-shell-mobile-nav"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>منوی ناوبری</SheetTitle>
              </SheetHeader>
              <Sidebar
                items={navItems}
                collapsed={false}
                embedded
                brand={sidebar?.brand}
                footer={sidebar?.footer}
                onNavigate={handleNavigate}
              />
            </SheetContent>
          </Sheet>
        ) : null}

        <div
          data-slot="app-shell-grid"
          className={cn(
            'flex min-h-0 flex-1',
            mode === 'mobile' && 'flex-col gap-shell-gap',
          )}
        >
          {mode !== 'mobile' ? (
            <div
              data-slot="app-shell-island-sidebar"
              className={cn(
                islandChrome,
                'me-shell-gap min-h-0 shrink-0 overflow-hidden',
                'transition-[width]',
                slideEase,
                collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
              )}
            >
              <Sidebar
                items={navItems}
                collapsed={collapsed}
                brand={sidebar?.brand}
                footer={sidebar?.footer}
                onNavigate={handleNavigate}
              />
            </div>
          ) : null}

          <div
            data-slot="app-shell-main"
            className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-shell-gap"
          >
            <div
              data-slot="app-shell-island-header"
              className={cn(islandChrome, 'shrink-0')}
            >
              <TopHeader
                {...header}
                showMenuButton={mode === 'mobile'}
                onMenuClick={() => setMobileOpen(true)}
              />
            </div>

            {mode === 'desktop' ? (
              <button
                type="button"
                data-slot="sidebar-collapse-toggle"
                aria-label={
                  collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'
                }
                aria-pressed={collapsed}
                className={cn(
                  'absolute top-[calc(var(--ps-header-height)+var(--ps-shell-gap)+0.75rem)] start-0 z-[var(--ps-z-sidebar)]',
                  '-translate-x-1/2 rtl:translate-x-1/2',
                  'inline-flex size-7 items-center justify-center rounded-full',
                  'border border-border-default bg-surface text-text-secondary shadow-shell',
                  'outline-none transition-transform',
                  slideEase,
                  'hover:bg-surface-hover focus-visible:shadow-focus',
                )}
                onClick={() => setCollapsed(!collapsed)}
              >
                <Icon
                  name={collapsed ? 'chevron_left' : 'chevron_right'}
                  size={16}
                  data-slot="icon"
                  className={cn('transition-transform', slideEase)}
                />
              </button>
            ) : null}

            <main
              data-slot="app-shell-island-content"
              className={cn(
                islandChrome,
                'ps-hide-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto',
              )}
            >
              <div
                data-slot="app-shell-container"
                className={cn(
                  'mx-auto flex w-full min-w-0 max-w-[1400px] flex-1 flex-col gap-4 px-4 pb-4 pt-16 tablet:px-6 tablet:pt-20 desktop:px-8',
                  contentClassName,
                )}
              >
                {children}
              </div>
            </main>
          </div>

          {pushEnabled ? (
            <aside
              data-slot="app-shell-island-drawer"
              data-pattern="side-drawer"
              data-side={drawer?.side ?? 'end'}
              data-state={drawerOpen ? 'open' : 'closed'}
              aria-hidden={drawerOpen ? undefined : true}
              aria-label={drawer?.title ?? 'کشوی کناری'}
              className={cn(
                'flex min-h-0 shrink-0 flex-col overflow-hidden bg-surface',
                'transition-[width,margin,border-color]',
                slideEase,
                drawerOpen
                  ? cn(islandChrome, 'ms-shell-gap w-drawer')
                  : 'ms-0 w-0 border-0',
                drawer?.className,
              )}
            >
              {drawer ? (
                <>
                  <div
                    data-slot="side-drawer-header"
                    className="flex shrink-0 items-start gap-3 border-b border-border-subtle p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-headline-sm font-semibold text-text-primary">
                        {drawer.title}
                      </h2>
                      {drawer.description ? (
                        <p className="mt-1 text-body-md text-text-secondary">
                          {drawer.description}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="بستن"
                      className="shrink-0"
                      onClick={() => drawer.onOpenChange?.(false)}
                    >
                      <Icon name="close" size={20} data-slot="icon" />
                    </Button>
                  </div>
                  <div
                    data-slot="side-drawer-body"
                    className="ps-hide-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
                  >
                    {drawer.body}
                  </div>
                  {drawer.footer ? (
                    <div
                      data-slot="side-drawer-footer"
                      className="mt-auto flex shrink-0 flex-col gap-2 border-t border-border-subtle p-4"
                    >
                      {drawer.footer}
                    </div>
                  ) : null}
                </>
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>
    </ShellDrawerContext.Provider>
  )
}

export { AppShell }
