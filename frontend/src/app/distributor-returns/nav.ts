import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getDistributorReturnsNavItems(
  activeId: AppNavId = 'distributor-returns',
) {
  return getAppNavItems(activeId)
}
