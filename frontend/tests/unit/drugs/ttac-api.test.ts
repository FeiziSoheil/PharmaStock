import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/http', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '@/lib/api/http'
import { apiSearchTtac } from '@/lib/api/drugs'

describe('apiSearchTtac', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset()
  })

  it('returns empty result for blank term without calling the API', async () => {
    const res = await apiSearchTtac('   ')
    expect(res).toEqual({ items: [], count: 0 })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('passes query params and returns items', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      items: [
        {
          irc: '122801000245011',
          gtin: '06260100024501',
          nameFa: 'آموکسی‌سیلین',
          brandName: 'کپسول ۵۰۰',
          manufacturer: 'دارو',
          status: 1,
          statusStr: 'فعال',
        },
      ],
      count: 1,
    })

    const res = await apiSearchTtac('آموکسی', {
      page: 2,
      pageSize: 5,
      includeInactive: true,
    })

    expect(apiRequest).toHaveBeenCalledWith('/api/v1/ttac/search', {
      query: {
        term: 'آموکسی',
        page: '2',
        pageSize: '5',
        includeInactive: 'true',
      },
    })
    expect(res).toEqual({
      items: [
        expect.objectContaining({ irc: '122801000245011', statusStr: 'فعال' }),
      ],
      count: 1,
    })
  })

  it('preserves soft error so the drawer can show error instead of not_found', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      items: [],
      count: 0,
      error: 'خطا در استعلام تی‌تک',
    })

    await expect(apiSearchTtac('قرص')).resolves.toEqual({
      items: [],
      count: 0,
      error: 'خطا در استعلام تی‌تک',
    })
  })
})
