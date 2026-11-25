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

test.describe('purchase invoice reconciliation', () => {
  test('uploads CSV, maps columns, approves price mismatch, and confirms into warehouse', async ({
    page,
  }) => {
    const stamp = Date.now().toString(36)
    const invoiceNo = `REC-${stamp}`
    const csvContent = [
      'نام کالا,بارکد,شناسه IRC,شماره بچ,تاریخ انقضا,تعداد,قیمت خرید,قیمت مصرف‌کننده',
      `آموکسی‌سیلین ۵۰۰,6260001000001,12345,AX-${stamp},1406/03/15,12,45000,45000`,
      `مورفین سولفات ۱۰,6260001000003,99001,MR-${stamp},1406/08/10,5,126000,126000`,
      `قلم جدید آزمایشی ${stamp},626999000${stamp.slice(-4)},998877,NW-${stamp},1406/09/01,3,200000,200000`,
    ].join('\n')

    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)

    await page.goto('/purchase-invoice-reconciliation')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'ثبت و بارگذاری فاکتور خرید دارو (اکسل و انطباق سیستمی)',
      }),
    ).toBeVisible({ timeout: 30_000 })

    await page.locator('#rec-invoice-no').fill(invoiceNo)
    const fileInput = page.locator('[data-slot="file-dropzone"] input[type="file"]')
    await fileInput.setInputFiles({
      name: `invoice-${stamp}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
    })

    await page.getByTestId('upload-reconcile-submit').click()

    await expect(page.getByTestId('apply-mapping-next')).toBeVisible({
      timeout: 20_000,
    })
    await page.getByTestId('apply-mapping-next').click()

    await expect(
      page.getByText('ردیف‌های استخراج‌شده از اکسل'),
    ).toBeVisible({ timeout: 20_000 })

    // Confirm button should be disabled until new item & price mismatch are resolved
    await expect(page.getByTestId('confirm-reconciliation-btn')).toBeDisabled()

    // Remove the unresolved new_item row, and technically approve the price mismatch row
    const newItemRow = page.locator('tr', { hasText: `قلم جدید آزمایشی ${stamp}` })
    await newItemRow.getByRole('button', { name: 'حذف ردیف' }).click()

    const mismatchRow = page.locator('tr', { hasText: `MR-${stamp}` })
    await mismatchRow.getByRole('button', { name: 'تایید فنی' }).click()

    await expect(page.getByTestId('confirm-reconciliation-btn')).toBeEnabled({
      timeout: 15_000,
    })
    await page.getByTestId('confirm-reconciliation-btn').click()

    await page.getByRole('button', { name: 'تایید و ثبت نهایی' }).click()

    const validBanner = page.locator('[data-slot="alert-banner"][data-tone="valid"]')
    await expect(validBanner).toContainText(
      'تطبیق فاکتور تایید نهایی و در انبار ثبت شد',
      { timeout: 20_000 },
    )
  })
})
