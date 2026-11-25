import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

/** @deprecated Prefer `getAppNavItems` — kept for existing screen imports. */
export function getCatalogNavItems(activeId: AppNavId = 'catalog') {
  return getAppNavItems(activeId)
}
