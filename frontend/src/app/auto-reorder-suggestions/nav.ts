import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getReorderNavItems(activeId: AppNavId = 'reorder') {
  return getAppNavItems(activeId)
}
