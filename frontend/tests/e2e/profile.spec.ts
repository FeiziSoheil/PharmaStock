import { expect, test } from '@playwright/test'

test.describe('User Profile (/profile)', () => {
  test.beforeEach(async ({ page }) => {
    // Inject active session before navigating
    await page.addInitScript(() => {
      window.sessionStorage.setItem('pharmastock.token', 'e2e-mock-token')
      window.sessionStorage.setItem(
        'pharmastock.user',
        JSON.stringify({
          id: 'user-rezaei',
          username: 'dr.rezaei',
          name: 'دکتر محمدرضا رضایی',
          role: 'technical_officer',
        }),
      )
    })

    // Mock /api/v1/auth/me
    await page.route('**/api/v1/auth/me', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-rezaei',
            username: 'dr.rezaei',
            name: 'دکتر محمدرضا رضایی',
            email: 'rezaei@pharmastock.ir',
            phone: '09121111111',
            personnelCode: 'MED-1001',
            medicalCouncilNo: '۱۴۰۳-۹۹',
            role: 'technical_officer',
            branchId: 'branch-central',
            branchNameFa: 'داروخانه مرکزی - انبار شماره ۱',
            unitLabel: 'واحد بالینی و کنترل کیفی',
            status: 'active',
            lastLoginAt: '2026-11-12T01:30:00Z',
            lastLoginIp: '192.168.1.100',
            lastLoginDevice: 'Playwright Browser',
          }),
        })
      }

      if (route.request().method() === 'PATCH') {
        const payload = JSON.parse(route.request().postData() || '{}')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-rezaei',
            username: 'dr.rezaei',
            name: payload.name || 'دکتر محمدرضا رضایی',
            email: payload.email || 'rezaei@pharmastock.ir',
            phone: payload.phone || '09121111111',
            personnelCode: 'MED-1001',
            role: 'technical_officer',
            branchId: 'branch-central',
            branchNameFa: 'داروخانه مرکزی - انبار شماره ۱',
            unitLabel: 'واحد بالینی و کنترل کیفی',
            status: 'active',
          }),
        })
      }

      return route.continue()
    })

    // Mock /api/v1/auth/change-password
    await page.route('**/api/v1/auth/change-password', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: 'رمز عبور با موفقیت تغییر یافت',
        }),
      })
    })
  })

  test('navigates from header UserMenu to /profile and displays details', async ({
    page,
  }) => {
    await page.goto('/dashboard')

    const userTrigger = page.locator('[data-slot="user-menu-trigger"]')
    await expect(userTrigger).toBeVisible()
    await userTrigger.click()

    const profileLink = page.locator('[data-slot="user-menu-content"] a[href="/profile"]')
    await expect(profileLink).toBeVisible()
    await profileLink.click()

    await expect(page).toHaveURL(/\/profile/)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'پروفایل و تنظیمات حساب کاربری',
      }),
    ).toBeVisible()

    await expect(page.getByText('dr.rezaei', { exact: true })).toBeVisible()
    await expect(page.getByText('MED-1001')).toBeVisible()
  })

  test('submits profile edits and updates user name', async ({ page }) => {
    await page.goto('/profile')

    const nameInput = page.getByLabel('نام و نام خانوادگی')
    await expect(nameInput).toHaveValue('دکتر محمدرضا رضایی')

    await nameInput.fill('دکتر محمدرضا رضایی بهمنش')
    await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()

    await expect(page.locator('text=مشخصات فردی با موفقیت ذخیره شد')).toBeVisible()
  })

  test('submits password change with success toast', async ({ page }) => {
    await page.goto('/profile')

    await page.getByLabel('رمز عبور فعلی').fill('CurPass123')
    await page.getByLabel('رمز عبور جدید', { exact: true }).fill('NewSecret2026')
    await page.getByLabel('تکرار رمز عبور جدید').fill('NewSecret2026')

    await page.getByRole('button', { name: 'تغییر رمز عبور' }).click()

    await expect(page.locator('text=رمز عبور با موفقیت تغییر یافت')).toBeVisible()
  })
})
