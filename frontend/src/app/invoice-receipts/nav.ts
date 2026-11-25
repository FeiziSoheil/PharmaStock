import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

export function getReceiptNavItems(activeId: AppNavId = 'receipts') {
  return getAppNavItems(activeId)
}
