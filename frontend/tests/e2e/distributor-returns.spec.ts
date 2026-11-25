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

test.describe('distributor-returns', () => {
  test('shows Persian heading, KPI cards, and grouped distributor batches', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)
    await page.goto('/distributor-returns')

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /مدیریت و صدور مرجوعی دارو به شرکت‌های پخش/,
      }),
    ).toBeVisible({ timeout: 30_000 })

    await expect(page.locator('[data-slot="distributor-returns"]')).toBeVisible()
    await expect(page.getByText('کل سری‌های ساخت در بازه')).toBeVisible()
    await expect(page.getByText('ارزش ریالی اقلام قابل استرداد')).toBeVisible()

    await expect(
      page.locator('[data-slot="distributor-return-group"]').first(),
    ).toBeVisible({ timeout: 20_000 })
  })

  test('can preview, issue, and settle a partial distributor return slip', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)
    await page.goto('/distributor-returns')

    const amoxRow = page.locator('tr[data-batch-id="batch-amox-1"]')
    await expect(amoxRow).toBeVisible({ timeout: 20_000 })

    // Clear all, select only batch-amox-1 with quantity 1 to preserve seeded stock
    await page.locator('#select-all-eligible-btn').click()
    const selectAllBtn = page.locator('#select-all-eligible-btn')
    if (
      (await selectAllBtn.textContent())?.includes('انتخاب تمام اقلام واجد شرایط')
    ) {
      // already deselected
    } else {
      await selectAllBtn.click()
    }

    const amoxCheckbox = amoxRow.getByRole('checkbox')
    await amoxCheckbox.check()

    const qtyInput = amoxRow.locator('input[type="number"]')
    await qtyInput.fill('1')

    await page.locator('#issue-return-slip-btn').click()
    await expect(
      page.getByRole('heading', {
        name: /پیش‌نمایش سند رسمی استرداد و مرجوعی دارو/,
      }),
    ).toBeVisible({ timeout: 15_000 })

    await page
      .getByRole('button', {
        name: /تایید نهایی، صدور حواله و کسر از کاردکس انبار/,
      })
      .click()

    await expect(
      page.locator('tr[data-slip-id]').first(),
    ).toBeVisible({ timeout: 20_000 })

    const inspectBtn = page
      .locator('tr[data-slip-id]')
      .first()
      .getByRole('button', { name: /پیش‌نمایش \/ تایید ویزیتور/ })
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click()
      await page.locator('#settle-credit-note').fill('CN-E2E-101')
      await page
        .getByRole('button', { name: /ثبت تایید ویزیتور و تسویه بستانکاری/ })
        .click()
      await expect(page.getByText('تسویه‌شده با ویزیتور').first()).toBeVisible({
        timeout: 15_000,
      })
    }
  })
})
