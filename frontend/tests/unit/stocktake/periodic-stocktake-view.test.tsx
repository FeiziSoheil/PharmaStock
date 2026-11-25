import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeriodicStocktakeView } from '@/app/periodic-stocktake/periodic-stocktake-view'
import { TooltipProvider } from '@/components/ui'
import type { StocktakeCycle } from '@/lib/types/stocktake'

const replaceMock = vi.fn()
const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/periodic-stocktake',
}))

const mockListStocktakes = vi.fn()
const mockGetStocktake = vi.fn()
const mockRecordStocktakeItem = vi.fn()
const mockConfirmStocktake = vi.fn()
const mockCreateStocktake = vi.fn()
const mockUpdateStocktake = vi.fn()
const mockExportStocktakeCsv = vi.fn()

vi.mock('@/lib/stocktake/data-access', () => ({
  listStocktakes: (...args: unknown[]) => mockListStocktakes(...args),
  getStocktake: (...args: unknown[]) => mockGetStocktake(...args),
  recordStocktakeItem: (...args: unknown[]) => mockRecordStocktakeItem(...args),
  confirmStocktake: (...args: unknown[]) => mockConfirmStocktake(...args),
  createStocktake: (...args: unknown[]) => mockCreateStocktake(...args),
  updateStocktake: (...args: unknown[]) => mockUpdateStocktake(...args),
  exportStocktakeCsv: (...args: unknown[]) => mockExportStocktakeCsv(...args),
}))

function sampleCycle(overrides: Partial<StocktakeCycle> = {}): StocktakeCycle {
  return {
    id: 'cycle-1',
    cycleCode: 'AUD-140308-01',
    status: 'active',
    zone: 'all',
    zoneLabel: 'همه بخش‌ها و قفسه‌های انبار',
    method: 'blind',
    counterName: 'مرتضی کاظمی',
    supervisorName: 'دکتر رضایی',
    summary: {
      totalItems: 2,
      countedItems: 1,
      skippedItems: 0,
      pendingItems: 1,
      progressPct: 50,
      shortageUnits: 2,
      shortageItemsCount: 1,
      surplusUnits: 0,
      surplusItemsCount: 0,
      matchedItemsCount: 0,
      highVarianceCount: 0,
      netVarianceRial: -64000,
    },
    items: [
      {
        id: 'st-1',
        batchId: 'b-1',
        drugId: 'drug-amox',
        nameFa: 'کپسول آموکسی‌سیلین ۵۰۰',
        gtin: '6260001000001',
        genericCode: '12345',
        batchNo: 'AX-2401',
        expiry: '2026-12-01',
        zone: 'A',
        binId: 'bin-a1',
        locationLabel: 'A-03-2-04',
        unitLabel: 'عدد',
        isControlled: false,
        unitPriceRial: 32000,
        systemQty: 20,
        physicalQty: 18,
        varianceQty: -2,
        varianceRial: -64000,
        varianceType: 'shortage',
        requiresSupervisor: false,
        countStatus: 'counted',
        varianceReason: 'کسری نسخه‌پیچی',
        supervisorVerified: false,
      },
      {
        id: 'st-2',
        batchId: 'b-2',
        drugId: 'drug-morphine',
        nameFa: 'مورفین سولفات',
        gtin: '6260001000003',
        genericCode: '99001',
        batchNo: 'MR-09',
        expiry: '2027-03-01',
        zone: 'S',
        binId: 'bin-s1',
        locationLabel: 'S-01-1-01',
        unitLabel: 'آمپول',
        isControlled: true,
        unitPriceRial: 90000,
        varianceType: 'pending',
        requiresSupervisor: false,
        countStatus: 'pending',
        supervisorVerified: false,
      },
    ],
    createdBy: { userId: 'u1', name: 'اپراتور انبار', role: 'warehouse_operator' },
    createdAt: '2026-11-11T08:30:00Z',
    updatedAt: '2026-11-11T09:00:00Z',
    ...overrides,
  }
}

describe('PeriodicStocktakeView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const initial = sampleCycle()
    mockListStocktakes.mockResolvedValue({
      items: [initial],
      total: 1,
      page: 1,
      pageSize: 25,
      pageCount: 1,
    })
    mockGetStocktake.mockResolvedValue(initial)
  })

  it('renders Persian heading, blind-count masking, and allows recording count & confirming', async () => {
    const user = userEvent.setup()
    const afterCount = sampleCycle({
      summary: {
        totalItems: 2,
        countedItems: 2,
        skippedItems: 0,
        pendingItems: 0,
        progressPct: 100,
        shortageUnits: 2,
        shortageItemsCount: 1,
        surplusUnits: 0,
        surplusItemsCount: 0,
        matchedItemsCount: 1,
        highVarianceCount: 0,
        netVarianceRial: -64000,
      },
    })
    const secondItem = afterCount.items[1]
    if (!secondItem) throw new Error('Expected second seeded item')
    afterCount.items[1] = {
      ...secondItem,
      systemQty: 12,
      physicalQty: 12,
      varianceQty: 0,
      varianceRial: 0,
      varianceType: 'match',
      countStatus: 'counted',
      varianceReason: 'شمارش مطابق کاردکس',
    }
    mockRecordStocktakeItem.mockResolvedValue(afterCount)
    mockConfirmStocktake.mockResolvedValue({
      ...afterCount,
      status: 'confirmed',
      adjustmentDocNo: 'ADJ-20261112-001',
    })

    render(
      <TooltipProvider>
        <PeriodicStocktakeView />
      </TooltipProvider>,
    )

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /شمارش و انبارگردانی دوره‌ای داروخانه/,
      }),
    ).toBeInTheDocument()

    // Pending item in blind mode hides system stock
    expect(screen.getByText('پنهان در شمارش کور')).toBeInTheDocument()

    // Count the active pending item (مورفین سولفات)
    const countInput = screen.getByLabelText(/تعداد شمارش‌شده در قفسه فعلی/)
    await user.clear(countInput)
    await user.type(countInput, '12')
    await user.click(
      screen.getByRole('button', { name: /ثبت شمارش و ادامه به داروی بعدی/ }),
    )

    await waitFor(() => {
      expect(mockRecordStocktakeItem).toHaveBeenCalledWith(
        'cycle-1',
        'st-2',
        expect.objectContaining({ action: 'count', physicalQty: 12 }),
      )
    })

    // Confirm cycle via ConfirmDialog
    await user.click(
      screen.getByRole('button', { name: /تایید نهایی و صدور سند تعدیل کاردکس/ }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /صدور قطعی سند تعدیل/ }),
    )

    await waitFor(() => {
      expect(mockConfirmStocktake).toHaveBeenCalledWith(
        'cycle-1',
        expect.objectContaining({ supervisorName: 'دکتر رضایی' }),
      )
    })

    expect(
      await screen.findByText(/سند تعدیل کاردکس ADJ-20261112-001 صادر/),
    ).toBeInTheDocument()
  })
})
