import { getAppNavItems, type AppNavId } from '@/lib/nav/app-nav'

/** Drug detail keeps catalog highlighted as the parent list screen. */
export function getDrugDetailsNavItems(activeId: AppNavId = 'catalog') {
  return getAppNavItems(activeId)
}
