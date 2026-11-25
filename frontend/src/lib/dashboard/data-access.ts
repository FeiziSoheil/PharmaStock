import { apiGetAllDrugs } from '@/lib/api/drugs'
import { apiGetExpiryBatches } from '@/lib/api/expiry'
import { apiGetReorderSuggestions } from '@/lib/api/reorder'
import { apiGetShelves } from '@/lib/api/shelves'
import { apiGetAuditEvents } from '@/lib/api/audit'
import { fetchAllPages } from '@/lib/api/paginate'
import { buildDashboardSnapshot } from '@/lib/dashboard/build-snapshot'
import type { DashboardSnapshot } from '@/lib/dashboard/types'
import type { ExpiryBatch } from '@/lib/types/expiry'
import type { ReorderSuggestion } from '@/lib/reorder/reorder-query'
import type { ShelfBin } from '@/lib/types/shelves'

export type GetDashboardSnapshotOptions = {
  today?: Date
  now?: Date
  fail?: boolean
}

/**
 * Compose dashboard KPIs from existing list endpoints.
 * There is no dedicated Go `/dashboard` route.
 */
export async function fetchDashboardSnapshot(
  options: GetDashboardSnapshotOptions = {},
): Promise<DashboardSnapshot> {
  if (options.fail) {
    throw new Error('DASHBOARD_API_FAIL')
  }

  const today = options.today ?? new Date()
  const now = options.now ?? new Date()

  const [drugs, batches, reorderRows, shelves, auditRes] = await Promise.all([
    apiGetAllDrugs(),
    fetchAllPages<ExpiryBatch>((page, pageSize) =>
      apiGetExpiryBatches({ page, pageSize }).then((res) => ({
        items: res.items,
        page: res.page,
        pageCount: res.pageCount,
      })),
    ),
    fetchAllPages<ReorderSuggestion>((page, pageSize) =>
      apiGetReorderSuggestions({
        page,
        pageSize,
        activeOnly: false,
        sortBy: 'daysOfCover',
        sortDir: 'asc',
      }).then((res) => ({
        items: res.items,
        page: res.page,
        pageCount: res.pageCount,
      })),
    ),
    fetchAllPages<ShelfBin>((page, pageSize) =>
      apiGetShelves({ page, pageSize }).then((res) => ({
        items: res.items,
        page: res.page,
        pageCount: res.pageCount,
      })),
    ),
    apiGetAuditEvents({ page: 1, pageSize: 25, sortDir: 'desc' }),
  ])

  const zoneCount = new Set(shelves.map((bin) => bin.zone)).size

  return buildDashboardSnapshot({
    today,
    now,
    drugs,
    batches,
    reorderRows,
    zoneCount: zoneCount || 1,
    shelfCount: shelves.length,
    auditEvents: auditRes.items,
    shiftLabel: 'نوبت کاری: بر اساس داده‌های زنده API',
    healthVersionLabel: 'پایش از سرویس Go (ترکیب لیست‌ها)',
  })
}
