import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getExpiryNavItems(activeId: AppNavId = 'alerts') {
  return getAppNavItems(activeId)
}
