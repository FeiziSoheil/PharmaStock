import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getDashboardNavItems(activeId: AppNavId = 'dashboard') {
  return getAppNavItems(activeId)
}
