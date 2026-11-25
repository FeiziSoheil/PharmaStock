import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getShelfNavItems(activeId: AppNavId = 'shelf') {
  return getAppNavItems(activeId)
}
