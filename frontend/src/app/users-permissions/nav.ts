import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getUsersPermissionsNavItems(
  activeId: AppNavId = 'users-permissions',
) {
  return getAppNavItems(activeId)
}
