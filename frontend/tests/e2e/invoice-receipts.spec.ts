import { expect, test, type Page } from '@playwright/test'

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function fromPersianDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) =>
    String(PERSIAN_DIGITS.indexOf(digit)),
  )
}

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit)
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

async function pickDatePicker(page: Page, testId: string, iso: string) {
  await page.getByTestId(testId).click()
  const panel = page.locator('[data-slot="date-picker-content"]')
  await expect(panel).toBeVisible()
  const day = panel.locator(`button[data-day="${iso}"]`)
  const target = new Date(`${iso}T12:00:00`)
  const navIcon = target.getTime() >= Date.now() ? 'chevron_left' : 'chevron_right'
  // In RTL layout, "next month" uses chevron_left visually for future dates.
  for (let attempt = 0; attempt < 48; attempt += 1) {
    if ((await day.count()) > 0) {
      await day.first().click()
      await expect(panel).toBeHidden({ timeout: 5_000 })
      return
    }
    await panel
      .locator('button')
      .filter({ has: page.locator(`[data-icon-resolved="${navIcon}"]`) })
      .first()
      .click()
  }
  throw new Error(`Could not find calendar day ${iso}`)
}

test.describe('invoice receipts', () => {
  test('happy path confirms a receipt and shows the batch', async ({ page }) => {
    const stamp = Date.now().toString(36)
    const invoiceNo = `E2E-${stamp}`
    const batchNo = `E2E${stamp}`
    const expiry = '2028-06-01'

    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)

    await page.goto('/invoice-receipts')
    await expect(
      page.getByRole('heading', { level: 1, name: 'ورود فاکتور و رسید انبار' }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('receipt-stepper')).toBeVisible()

    await page.getByTestId('receipt-invoice-no').fill(invoiceNo)
    await page.getByTestId('receipt-distributor').fill('پخش آزمون پایان‌به‌پایان')
    await pickDatePicker(page, 'receipt-issued-at', '2026-11-01')
    await pickDatePicker(page, 'receipt-received-at', '2026-11-12')
    await page.getByTestId('receipt-warehouse').fill('انبار مرکزی')
    await page.getByTestId('receipt-save-header').click()

    await expect(page.getByTestId('receipt-drug-id')).toBeVisible({
      timeout: 20_000,
    })
    await expect(page).toHaveURL(/receiptId=/)

    await page.getByTestId('receipt-drug-id').fill('drug-amox')
    await page.getByRole('button', { name: 'بازیابی' }).click()
    await expect(page.locator('#receipt-drug-name')).toHaveValue(/آموکسی/, {
      timeout: 15_000,
    })

    await page.getByTestId('receipt-batch').fill(batchNo)
    await pickDatePicker(page, 'receipt-expiry', expiry)
    await page.getByTestId('receipt-qty').fill('4')
    await page.getByTestId('receipt-buy-price').fill('32000')
    await page.getByTestId('receipt-add-line').click()

    await expect(page.getByTestId('receipt-lines')).toContainText('drug-amox', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('receipt-lines')).toContainText(batchNo)
    await page.getByTestId('receipt-next').click()

    const location = page.locator('[data-testid^="receipt-location-"]')
    await expect(location).toBeVisible({ timeout: 15_000 })
    await location.fill('B-12')
    await expect(page.getByTestId('receipt-confirm')).toBeEnabled()
    await page.getByTestId('receipt-confirm').click()

    const confirmed = page.locator('[data-slot="alert-banner"][data-tone="valid"]')
    await expect(confirmed).toContainText('رسید تایید شد', { timeout: 20_000 })
    await expect(page.getByText('تاییدشده', { exact: true })).toBeVisible()
    await expect(page.getByTestId('receipt-confirm')).toBeDisabled()

    await page.goto('/expiry-alerts-fefo')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'پایش تاریخ انقضا و مدیریت سری ساخت (FEFO)',
      }),
    ).toBeVisible({ timeout: 30_000 })
    await page.getByLabel('جستجوی نام دارو یا سری ساخت').fill(batchNo)
    await expect(page.getByText(batchNo, { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByText(`فاکتور: ${toPersianDigits(invoiceNo)}`),
    ).toBeVisible()
  })
})
