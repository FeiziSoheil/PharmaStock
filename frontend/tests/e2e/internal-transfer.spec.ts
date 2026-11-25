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

test.describe('internal-transfer', () => {
  test('shows Persian heading and stepper', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)
    await page.goto('/internal-transfer')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /فرم حواله انتقال داخلی/,
      }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('انتخاب اقلام و تخصیص بَچ')).toBeVisible()
    await expect(page.locator('[data-slot="internal-transfer"]')).toBeVisible()
  })

  test('happy path draft, line, confirm, and cardex verification', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)

    await page.goto('/internal-transfer')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /فرم حواله انتقال داخلی/,
      }),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'ذخیره سربرگ حواله' }).click()
    await expect(page).toHaveURL(/transferId=/, { timeout: 20_000 })

    await page.locator('#transfer-drug-search').fill('آمو')
    const drugHit = page
      .locator('[data-slot="internal-transfer"] ul button')
      .first()
    await expect(drugHit).toBeVisible({ timeout: 20_000 })
    await drugHit.click()

    const batchRadio = page.locator('input[name="source-batch"]').first()
    await expect(batchRadio).toBeVisible({ timeout: 20_000 })
    await batchRadio.check()

    await page.locator('#transfer-qty').fill('1')

    await page.locator('#transfer-dest-bin').click()
    const destOption = page.getByRole('option').first()
    await expect(destOption).toBeVisible({ timeout: 15_000 })
    await destOption.click()

    await page.getByRole('button', { name: 'افزودن قلم به حواله' }).click()
    await expect(
      page.getByRole('cell', { name: /آمو/i }).first(),
    ).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'ادامه به بازبینی' }).click()
    await expect(page.getByText('تایید تحویل‌دهنده و تحویل‌گیرنده')).toBeVisible()

    await page.locator('#transfer-receiver-name').fill('الهام یزدانی')

    const transferRoot = page.locator('[data-slot="internal-transfer"]')
    const checkboxes = transferRoot.getByRole('checkbox')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check()
    }

    await page.getByRole('button', { name: 'تایید نهایی حواله' }).click()

    const confirmedBanner = page.locator(
      '[data-slot="alert-banner"][data-tone="valid"]',
    )
    await expect(confirmedBanner).toContainText('حواله تایید شد', {
      timeout: 30_000,
    })
    await expect(confirmedBanner).toContainText(/TRF-/)

    await page.getByRole('link', { name: 'کاردکس دارو' }).click()
    await expect(page).toHaveURL(/drug-details-cardex\?drugId=/, {
      timeout: 20_000,
    })
    await expect(
      page.getByText(/پیشخوان تحویل نسخه › C-01-1-01/).first(),
    ).toBeVisible({ timeout: 20_000 })
    await page
      .getByRole('tab', { name: /گردش موجودی و کاردکس انبار/ })
      .click()
    await expect(page.getByText(/انتقال داخلی از/).first()).toBeVisible({
      timeout: 20_000,
    })
  })
})
