import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getInternalTransferNavItems(
  activeId: AppNavId = 'internal-transfer',
) {
  return getAppNavItems(activeId)
}
