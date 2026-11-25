import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getPeriodicStocktakeNavItems(
  activeId: AppNavId = 'periodic-stocktake',
) {
  return getAppNavItems(activeId)
}
