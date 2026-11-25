import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getPurchaseReconciliationNavItems(
  activeId: AppNavId = 'purchase-reconciliation',
) {
  return getAppNavItems(activeId)
}
