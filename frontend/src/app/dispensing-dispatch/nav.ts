import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getDispensingNavItems(activeId: AppNavId = 'dispensing') {
  return getAppNavItems(activeId)
}
