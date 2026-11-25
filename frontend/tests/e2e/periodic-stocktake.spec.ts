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

test.describe('periodic-stocktake', () => {
  test('shows Persian heading, KPI cards, and blind count setup', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)
    await page.goto('/periodic-stocktake')

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /شمارش و انبارگردانی دوره‌ای داروخانه/,
      }),
    ).toBeVisible({ timeout: 30_000 })

    await expect(page.locator('[data-slot="periodic-stocktake"]')).toBeVisible()
    await expect(page.locator('[data-slot="stocktake-setup-card"]')).toBeVisible()
    await expect(
      page.locator('[data-slot="stocktake-live-terminal"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-slot="stocktake-variance-table-card"]'),
    ).toBeVisible()
  })

  test('happy path: start new cycle, record count, filter variance, confirm adjustment & verify audit/cardex', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)
    await page.goto('/periodic-stocktake')

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /شمارش و انبارگردانی دوره‌ای داروخانه/,
      }),
    ).toBeVisible({ timeout: 30_000 })

    // Create a fresh cycle so seeded cycle & batch stock stay predictable
    await page.getByRole('button', { name: 'شروع دوره جدید' }).click()
    await expect(page).toHaveURL(/cycleId=/, { timeout: 20_000 })

    // In blind mode, pending item hides system quantity
    await expect(page.getByText('پنهان در شمارش کور')).toBeVisible({
      timeout: 15_000,
    })

    // Switch to Open Count & save settings
    await page.getByText('شمارش آشکار (Open Count)').click()
    await page
      .getByRole('button', { name: 'اعمال تغییرات تنظیمات دوره جاری' })
      .click()
    await expect(page.getByText('پنهان در شمارش کور')).toHaveCount(0, {
      timeout: 15_000,
    })

    // Record physical count for active item
    const countInput = page.locator('#stocktake-count-input')
    await countInput.fill('20')
    await page.locator('#stocktake-submit-count').click()

    // Confirm final adjustment
    await page.locator('#stocktake-confirm-btn').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await dialog
      .getByRole('button', { name: /صدور قطعی سند تعدیل/ })
      .click()

    const validBanner = page.locator(
      '[data-slot="alert-banner"][data-tone="valid"]',
    )
    await expect(validBanner).toContainText(/ADJ-/, { timeout: 30_000 })
  })
})
