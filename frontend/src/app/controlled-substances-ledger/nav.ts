import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getControlledNavItems(
  activeId: AppNavId = 'controlled-substances',
) {
  return getAppNavItems(activeId)
}
