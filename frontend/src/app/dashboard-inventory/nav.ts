import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getInventoryDashboardNavItems(
  activeId: AppNavId = 'dashboard-inventory',
) {
  return getAppNavItems(activeId)
}
