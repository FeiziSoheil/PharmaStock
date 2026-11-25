'use client'

import * as React from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { IconName } from '@/lib/icons'
import { cn } from '@/lib/utils'

export type SidebarNavItem = {
  id: string
  label: string
  href: string
  icon: IconName
  badge?: string | number
  active?: boolean
  section?: string
}

export type SidebarProps = {
  items: SidebarNavItem[]
  collapsed?: boolean
  brand?: {
    title?: string
    subtitle?: string
  }
  footer?: React.ReactNode
  onNavigate?: (item: SidebarNavItem) => void
  className?: string
  /** When true, renders as static panel (e.g. inside mobile Sheet). */
  embedded?: boolean
}

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: SidebarNavItem
  collapsed: boolean
  onNavigate?: (item: SidebarNavItem) => void
}) {
  const content = (
    <Link
      href={item.href}
      data-slot="sidebar-nav-item"
      data-active={item.active ? 'true' : undefined}
      data-collapsed={collapsed ? 'true' : undefined}
      aria-current={item.active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      onClick={() => onNavigate?.(item)}
      className={cn(
        'group relative flex h-11 items-center gap-3 rounded-default text-body-md',
        'transition-[background-color,color] duration-150 ease-out',
        'outline-none focus-visible:border-primary focus-visible:shadow-focus',
        'motion-reduce:transition-none',
        collapsed ? 'w-11 justify-center px-0' : 'w-full px-3',
        item.active
          ? 'bg-primary-tint font-semibold text-primary'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Icon
        name={item.icon}
        size={22}
        filled={item.active}
        data-slot="icon"
        className={cn('shrink-0', item.active ? 'text-primary' : undefined)}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-start transition-[opacity,max-width] duration-[400ms] ease-[cubic-bezier(0.33,1,0.68,1)]',
          'motion-reduce:transition-none',
          collapsed
            ? 'pointer-events-none max-w-0 opacity-0'
            : 'max-w-[12rem] opacity-100',
        )}
        aria-hidden={collapsed || undefined}
      >
        {item.label}
      </span>
      {item.badge != null ? (
        <span
          className={cn(
            'rounded-badge bg-status-critical-bg px-2 py-0.5 text-label-sm text-status-critical-fg tabular-nums-data',
            'transition-opacity duration-[400ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none',
            collapsed ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
          aria-hidden={collapsed || undefined}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  )

  if (!collapsed) return content

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="left" sideOffset={10}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

const SECTIONS_STORAGE_KEY = 'pharmastock_sidebar_collapsed_sections'
const EMPTY_COLLAPSED_SECTIONS: Record<string, boolean> = {}

let cachedSectionsRaw: string | null | undefined
let cachedCollapsedSections: Record<string, boolean> = EMPTY_COLLAPSED_SECTIONS
const collapsedSectionListeners = new Set<() => void>()

function readCollapsedSectionsRaw(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(SECTIONS_STORAGE_KEY)
  } catch {
    return null
  }
}

function getCollapsedSectionsSnapshot(): Record<string, boolean> {
  const raw = readCollapsedSectionsRaw()
  if (raw === cachedSectionsRaw) {
    return cachedCollapsedSections
  }
  cachedSectionsRaw = raw
  if (!raw) {
    cachedCollapsedSections = EMPTY_COLLAPSED_SECTIONS
    return cachedCollapsedSections
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>
    cachedCollapsedSections =
      parsed && typeof parsed === 'object' ? parsed : EMPTY_COLLAPSED_SECTIONS
  } catch {
    cachedCollapsedSections = EMPTY_COLLAPSED_SECTIONS
  }
  return cachedCollapsedSections
}

function getServerCollapsedSections(): Record<string, boolean> {
  return EMPTY_COLLAPSED_SECTIONS
}

function subscribeCollapsedSections(listener: () => void) {
  collapsedSectionListeners.add(listener)
  if (typeof window === 'undefined') {
    return () => {
      collapsedSectionListeners.delete(listener)
    }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === SECTIONS_STORAGE_KEY || event.key === null) {
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    collapsedSectionListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function setCollapsedSections(next: Record<string, boolean>) {
  const raw = JSON.stringify(next)
  cachedSectionsRaw = raw
  cachedCollapsedSections = next
  try {
    localStorage.setItem(SECTIONS_STORAGE_KEY, raw)
  } catch {
    // ignore
  }
  for (const listener of collapsedSectionListeners) {
    listener()
  }
}

/**
 * RTL navigation rail: 260px expanded / 72px collapsed icon rail with tooltips.
 * Anchored to inline-start (physical right in RTL).
 */
function Sidebar({
  items,
  collapsed = false,
  brand = {
    title: 'فارما استاک',
    subtitle: 'مدیریت بالینی انبار',
  },
  footer,
  onNavigate,
  className,
  embedded = false,
}: SidebarProps) {
  const collapsedSections = React.useSyncExternalStore(
    subscribeCollapsedSections,
    getCollapsedSectionsSnapshot,
    getServerCollapsedSections,
  )

  const toggleSection = React.useCallback((title: string) => {
    const prev = getCollapsedSectionsSnapshot()
    setCollapsedSections({ ...prev, [title]: !prev[title] })
  }, [])

  const groupedSections = React.useMemo(() => {
    const sections: Array<{ title?: string; items: SidebarNavItem[] }> = []
    let currentSection: { title?: string; items: SidebarNavItem[] } | null = null

    for (const item of items) {
      if (!currentSection || currentSection.title !== item.section) {
        currentSection = { title: item.section, items: [item] }
        sections.push(currentSection)
      } else {
        currentSection.items.push(item)
      }
    }
    return sections
  }, [items])

  return (
    <aside
      data-slot="sidebar"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label="ناوبری اصلی"
      className={cn(
        'flex h-full w-full flex-col bg-surface',
        !embedded && 'relative z-[var(--ps-z-sidebar)]',
        className,
      )}
    >
      <div
        data-slot="sidebar-brand"
        className={cn(
          'flex h-header shrink-0 items-center border-b border-border-subtle',
          'transition-[padding,gap] duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]',
          'motion-reduce:transition-none',
          collapsed ? 'justify-center gap-0 px-2' : 'gap-3 px-4',
        )}
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-default bg-primary-tint text-primary">
          <Icon name="local_pharmacy" size={22} filled data-slot="icon" />
        </span>
        <div
          className={cn(
            'min-w-0 flex-1 overflow-hidden transition-[opacity,max-width] duration-[400ms] ease-[cubic-bezier(0.33,1,0.68,1)]',
            'motion-reduce:transition-none',
            collapsed
              ? 'pointer-events-none max-w-0 opacity-0'
              : 'max-w-[12rem] opacity-100',
          )}
          aria-hidden={collapsed || undefined}
        >
          <p className="truncate text-title-sm text-text-primary">
            {brand.title}
          </p>
          {brand.subtitle ? (
            <p className="truncate text-label-sm text-text-muted">
              {brand.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <nav
        data-slot="sidebar-nav"
        className={cn(
          'ps-hide-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto py-3',
          'transition-[padding] duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]',
          'motion-reduce:transition-none',
          collapsed ? 'items-center px-2' : 'px-3',
        )}
      >
        {groupedSections.map((section, idx) => {
          const hasActiveItem = section.items.some((it) => it.active)
          const isSectionCollapsed =
            !collapsed && section.title
              ? hasActiveItem
                ? false
                : Boolean(collapsedSections[section.title])
              : false

          return (
            <div
              key={section.title ?? `sec-${idx}`}
              className={cn(
                'flex flex-col gap-1 w-full',
                collapsed ? 'items-center' : '',
              )}
              data-slot="sidebar-nav-group"
            >
              {section.title ? (
                collapsed ? (
                  idx > 0 ? (
                    <div
                      role="separator"
                      data-slot="sidebar-nav-section-divider"
                      className="my-1.5 h-px w-8 bg-border-subtle shrink-0"
                    />
                  ) : null
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title!)}
                    aria-expanded={!isSectionCollapsed}
                    data-slot="sidebar-nav-section-toggle"
                    className={cn(
                      'group flex w-full items-center justify-between rounded-default px-3 py-1.5 text-label-sm font-semibold text-text-muted select-none transition-colors hover:bg-surface-hover hover:text-text-primary',
                      idx > 0 ? 'mt-2' : 'mt-0',
                    )}
                  >
                    <span className="truncate">{section.title}</span>
                    <Icon
                      name="expand_more"
                      size={16}
                      className={cn(
                        'shrink-0 text-text-muted transition-transform duration-200 group-hover:text-text-primary',
                        isSectionCollapsed ? 'rotate-90' : 'rotate-0',
                      )}
                    />
                  </button>
                )
              ) : null}
              <div
                data-slot="sidebar-nav-section-items"
                className={cn(
                  'flex flex-col gap-1 w-full overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out',
                  isSectionCollapsed
                    ? 'max-h-0 opacity-0 pointer-events-none'
                    : 'max-h-[1000px] opacity-100',
                )}
                aria-hidden={isSectionCollapsed || undefined}
              >
                {section.items.map((item) => (
                  <NavLink
                    key={item.id}
                    item={item}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {footer ? (
        <div
          data-slot="sidebar-footer"
          className={cn(
            'border-t border-border-subtle p-3',
            collapsed && 'flex justify-center',
          )}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  )
}

export { Sidebar }
