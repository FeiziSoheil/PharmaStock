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

test.describe('dispensing dispatch', () => {
  test('happy path confirms a dispense and shows the order', async ({ page }) => {
    const patientName = `بیمار آزمون ${Date.now().toString(36)}`

    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)

    await page.goto('/dispensing-dispatch')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'میز کار نسخه‌پیچی و صدور حواله خروج کالا',
      }),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByTestId('dispensing-drug-search').fill('آموکسی')
    const hit = page.getByRole('button', { name: /آموکسی‌سیلین/ })
    await expect(hit).toBeVisible({ timeout: 15_000 })
    await hit.click()

    await expect(page).toHaveURL(/orderId=/, { timeout: 20_000 })
    await expect(page.getByText('آموکسی‌سیلین', { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('تخصیص هوشمند بر مبنای FEFO')).toBeVisible()
    await expect(page.getByText('AX-2401', { exact: true })).toBeVisible()

    const patient = page.getByTestId('dispensing-patient-name')
    if ((await patient.inputValue()).trim() === '') {
      await patient.fill(patientName)
    }
    await patient.blur()

    const confirm = page.getByTestId('dispensing-confirm')
    await expect(confirm).toBeEnabled({ timeout: 20_000 })
    await confirm.click()

    const confirmed = page.locator('[data-slot="alert-banner"][data-tone="valid"]')
    await expect(confirmed).toContainText('حواله خروج صادر شد', { timeout: 20_000 })
    await expect(
      page.getByText('حواله خروج صادر شد و کاردکس انبار به‌روز شد.'),
    ).toBeVisible()
    await expect(page.getByText('تاییدشده', { exact: true })).toBeVisible()
    await expect(page.getByText(/حواله #/)).toBeVisible()
    await expect(
      page.getByText('این حواله فقط خواندنی است.', { exact: true }),
    ).toBeVisible()
    await expect(confirm).toBeDisabled()
  })
})
