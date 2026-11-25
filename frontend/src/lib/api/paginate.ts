/** Fetch every page from a list endpoint (backend caps pageSize at 50). */

export type PageResult<T> = {
  items: T[]
  page: number
  pageCount: number
}

export async function fetchAllPages<T>(
  loadPage: (page: number, pageSize: number) => Promise<PageResult<T>>,
  pageSize = 50,
): Promise<T[]> {
  const first = await loadPage(1, pageSize)
  const items = [...(first.items ?? [])]
  const pageCount = Math.max(1, first.pageCount || 1)
  for (let page = 2; page <= pageCount; page += 1) {
    const next = await loadPage(page, pageSize)
    items.push(...(next.items ?? []))
  }
  return items
}
