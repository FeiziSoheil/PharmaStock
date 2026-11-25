import { expect, test, type Page } from '@playwright/test'

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function fromPersianDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) =>
    String(PERSIAN_DIGITS.indexOf(digit)),
  )
}

async function loginAsOperator(page: Page) {
  await page.goto('/login')
  await expect(page.locator('[data-slot="login-page"]')).toBeVisible({
    timeout: 30_000,
  })
  await page.locator('#login-username').fill('operator')
  await page.locator('#login-password').fill('change-me-demo-only')
  const challenge = page.locator('[data-slot="login-captcha-challenge"]')
  await expect(challenge).toHaveAttribute('data-ready', 'true')
  const digits = await challenge.locator('span').allTextContents()
  await page.locator('#login-captcha').fill(fromPersianDigits(digits.join('')))
  await page.getByRole('button', { name: 'ادامه به فضای کاری' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
}

test.describe('dashboard-inventory', () => {
  test.describe.configure({ timeout: 90_000 })

  test('renders KPIs, inventory table, filters and no horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)

    await page.goto('/dashboard-inventory', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'داشبورد مدیریت انبار دارو',
      }),
    ).toBeVisible({ timeout: 30_000 })

    await expect(page.locator('[data-slot="kpi-metric-card"]')).toHaveCount(4, {
      timeout: 20_000,
    })
    await expect(page.locator('[data-slot="dense-data-table"]')).toBeVisible()
    await expect(page.getByText('آموکسی‌سیلین').first()).toBeVisible()

    // Filter by search
    const searchInput = page.getByLabel('فیلتر موجودی انبار')
    await searchInput.fill('انسولین')
    await expect(page.getByText('انسولین قلمی').first()).toBeVisible({
      timeout: 15_000,
    })

    // Clear filter chip
    await page.getByRole('button', { name: 'پاک‌سازی همه فیلترها' }).click()
    await expect(page.getByText('آموکسی‌سیلین').first()).toBeVisible({
      timeout: 15_000,
    })

    const hasPageHScroll = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth > doc.clientWidth + 1
    })
    expect(hasPageHScroll).toBe(false)
  })

  test('opens stock-in drawer and creates a new batch', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)

    await page.goto('/dashboard-inventory', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'داشبورد مدیریت انبار دارو',
      }),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'ورود داروی جدید به انبار' }).click()
    await expect(
      page.getByRole('heading', { name: 'ورود داروی جدید به انبار' }),
    ).toBeVisible({ timeout: 10_000 })

    const batchNo = `E2E-INV-${Date.now()}`
    await page.locator('#stock-in-batchNo').fill(batchNo)

    // Pick expiry via DatePicker
    await page.locator('#stock-in-expiry').click()
    await page.locator('[data-slot="date-picker-content"] button[data-day]').last().click()

    await page.locator('#stock-in-quantity').fill('15')
    await page.getByRole('button', { name: 'ثبت و افزودن به کاردکس انبار' }).click()

    await expect(page.getByText(batchNo)).toBeVisible({ timeout: 20_000 })
  })
})
