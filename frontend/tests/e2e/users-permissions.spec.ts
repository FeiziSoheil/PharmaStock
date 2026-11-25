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

test.describe('users-permissions', () => {
  test('renders Persian heading, KPIs, RTL matrix, and persists matrix toggle', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)

    await page.goto('/users-permissions')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'مدیریت کاربران و ماتریس دسترسی‌ها',
      }),
    ).toBeVisible({ timeout: 30_000 })

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('[data-slot="kpi-metric-card"]')).toHaveCount(4)

    const matrix = page.locator('[data-slot="rbac-permission-matrix"]')
    await expect(matrix).toBeVisible({ timeout: 20_000 })

    // Regulatory lock badges visible
    await expect(page.getByText('انحصار مسئول فنی').first()).toBeVisible()
    await expect(page.getByText('غیرمجاز فنی').first()).toBeVisible()

    // Toggle a non-locked permission checkbox and persist
    const targetCheckbox = page.getByRole('checkbox', {
      name: 'افزودن داروی جدید به کاتالوگ ژنریک و قیمت‌گذاری مصوب — انباردار داروخانه',
    })
    await expect(targetCheckbox).toBeVisible()
    const beforeChecked =
      (await targetCheckbox.getAttribute('aria-checked')) === 'true'
    await targetCheckbox.click()

    await page.getByRole('button', { name: 'ذخیره تغییرات ماتریس' }).click()
    await expect(
      page.getByText(/تغییرات ماتریس دسترسی‌ها با موفقیت ذخیره/),
    ).toBeVisible({ timeout: 15_000 })

    await page.reload()
    await expect(matrix).toBeVisible({ timeout: 20_000 })
    const afterCheckbox = page.getByRole('checkbox', {
      name: 'افزودن داروی جدید به کاتالوگ ژنریک و قیمت‌گذاری مصوب — انباردار داروخانه',
    })
    await expect(afterCheckbox).toHaveAttribute(
      'aria-checked',
      beforeChecked ? 'false' : 'true',
    )

    // Restore original state cleanly
    await afterCheckbox.click()
    await page.getByRole('button', { name: 'ذخیره تغییرات ماتریس' }).click()
    await expect(
      page.getByText(/تغییرات ماتریس دسترسی‌ها با موفقیت ذخیره/),
    ).toBeVisible({ timeout: 15_000 })

    // No horizontal page overflow
    const hasOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    )
    expect(hasOverflow).toBe(false)
  })

  test('users list tab: filter, create user, edit permissions drawer, and reset password', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)

    await page.goto('/users-permissions')
    await page.getByRole('tab', { name: /فهرست کاربران و پرسنل/ }).click()

    const table = page.locator('[data-slot="dense-data-table"]')
    await expect(table).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('دکتر محمدرضا رضایی')).toBeVisible()

    // Create a unique user
    const uniqueSuffix = Date.now().toString().slice(-5)
    const username = `e2e.user.${uniqueSuffix}`
    const fullName = `دکتر آزاده تست ${uniqueSuffix}`

    await page.getByRole('button', { name: 'افزودن کاربر جدید' }).click()
    const drawer = page.locator('[data-slot="user-form-drawer"]')
    await expect(drawer).toBeVisible()

    await drawer.locator('#user-form-name').fill(fullName)
    await drawer.locator('#user-form-username').fill(username)
    await drawer.locator('#user-form-personnel').fill(`EMP-${uniqueSuffix}`)
    await drawer.locator('#user-form-phone').fill('09123334455')
    await drawer.locator('#user-form-email').fill(`${username}@pharmastock.ir`)
    await drawer.locator('#user-form-role').click()
    await page.getByRole('option', { name: /انباردار داروخانه/ }).click()
    await drawer.locator('#user-form-password').fill('TestPass1234')

    await page
      .getByRole('button', { name: 'ثبت و صدور حساب کاربری' })
      .click()

    await expect(drawer).toBeHidden({ timeout: 15_000 })

    // Filter to find created user
    await page.getByLabel('جستجوی پرسنل').fill(username)
    await expect(page.getByText(fullName)).toBeVisible({ timeout: 15_000 })

    // Open custom permissions drawer
    await page
      .getByRole('button', { name: `تنظیم مجوز اختصاصی ${fullName}` })
      .click()
    await expect(
      page.locator('[data-slot="user-permissions-drawer"]'),
    ).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')

    // Open reset password dialog
    await page
      .getByRole('button', { name: `بازنشانی کلمه عبور ${fullName}` })
      .click()
    const resetDialog = page.locator('[data-slot="reset-password-dialog"]')
    await expect(resetDialog).toBeVisible()
    await resetDialog.locator('#reset-pw-new').fill('NewPass5678')
    await resetDialog.locator('#reset-pw-confirm').fill('NewPass5678')
    await resetDialog
      .getByRole('button', { name: 'ثبت رمز عبور جدید' })
      .click()
    await expect(resetDialog).toBeHidden({ timeout: 15_000 })
  })
})
