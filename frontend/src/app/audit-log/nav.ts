import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getAuditNavItems(activeId: AppNavId = 'audit-log') {
  return getAppNavItems(activeId)
}
