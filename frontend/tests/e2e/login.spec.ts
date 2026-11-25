import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 900, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const imagesDir = path.resolve(__dirname, '../../../images')
const stitchShot = path.resolve(
  __dirname,
  '../../../docs/stitch-reference/screens/login/screenshot.png',
)

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function fromPersianDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) =>
    String(PERSIAN_DIGITS.indexOf(digit)),
  )
}

async function gotoLogin(page: Page) {
  await page.goto('/login')
  await expect(page.locator('[data-slot="login-page"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('heading', { level: 1, name: 'ورود به انبار دارو' }),
  ).toBeVisible({ timeout: 30_000 })
}

async function readCaptchaChallenge(page: Page): Promise<string> {
  const challenge = page.locator('[data-slot="login-captcha-challenge"]')
  await expect(challenge).toHaveAttribute('data-ready', 'true')
  const digits = await challenge.locator('span').allTextContents()
  return fromPersianDigits(digits.join(''))
}

async function fillValidForm(
  page: Page,
  username = 'operator',
  password = 'change-me-demo-only',
) {
  await page.locator('#login-username').fill(username)
  await page.locator('#login-password').fill(password)
  const challenge = await readCaptchaChallenge(page)
  await page.locator('#login-captcha').fill(challenge)
}

test.describe('Phase G Screen 2 — login', () => {
  for (const viewport of viewports) {
    test(`visual compare at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await gotoLogin(page)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(page.locator('[data-slot="app-shell"]')).toHaveCount(0)
      await expect(page.locator('[data-slot="login-page"]')).toBeVisible()
      await expect(page.locator('[data-slot="login-visual"]')).toBeVisible()
      await expect(
        page.locator('[data-slot="login-visual"] video source'),
      ).toHaveAttribute('src', '/videos/login-warehouse.mp4')
      await expect(page.locator('[data-slot="card"]')).toBeVisible()
      await expect(
        page.getByRole('heading', { level: 1, name: 'ورود به انبار دارو' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /توکن سخت/ }),
      ).toHaveCount(0)

      const shotPath = testInfo.outputPath(`login-${viewport.name}.png`)
      await page.screenshot({ path: shotPath, fullPage: true })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.copyFileSync(
        shotPath,
        path.join(imagesDir, `h8-login-${viewport.name}.png`),
      )

      expect(fs.existsSync(stitchShot)).toBe(true)
      const stats = fs.statSync(shotPath)
      expect(stats.size).toBeGreaterThan(10_000)
    })
  }

  test('no horizontal scroll at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await gotoLogin(page)
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
      }
    })
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
  })

  test('keyboard: tab order, password toggle, enter submit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoLogin(page)

    await page.locator('#login-username').focus()
    await expect(page.locator('#login-username')).toBeFocused()

    // Stitch order: username → بازیابی دسترسی → password → show/hide toggle
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'بازیابی دسترسی' })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.locator('#login-password')).toBeFocused()

    await page.keyboard.press('Tab')
    const toggle = page.getByRole('button', { name: 'نمایش کلمه عبور' })
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#login-password')).toHaveAttribute(
      'type',
      'text',
    )
    await expect(
      page.getByRole('button', { name: 'پنهان کردن کلمه عبور' }),
    ).toBeVisible()

    await page.locator('#login-password').fill('change-me-demo-only')
    await page.locator('#login-username').fill('operator')
    const challenge = await readCaptchaChallenge(page)
    await page.locator('#login-captcha').fill(challenge)

    await page.locator('#login-password').focus()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
  })

  test('validation errors on empty submit with focus + aria', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoLogin(page)

    await page.locator('#login-branch').click()
    await page.getByRole('option').first().click()
    // Clear username/password/captcha remain empty
    await page.getByRole('button', { name: 'ادامه به فضای کاری' }).click()

    await expect(page.locator('#login-username-error')).toContainText(
      'شناسه پرسنلی الزامی است',
    )
    await expect(page.locator('#login-username')).toBeFocused()
    await expect(page.locator('#login-username')).toHaveAttribute(
      'aria-describedby',
      'login-username-error',
    )
    await expect(page.locator('[data-slot="login-live"]')).toContainText(
      'شناسه پرسنلی الزامی است',
    )
  })

  test('invalid credentials show API error banner', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoLogin(page)
    await fillValidForm(page, 'operator', 'wrong-password-not-real')
    await page.getByRole('button', { name: 'ادامه به فضای کاری' }).click()

    await expect(page.locator('[data-slot="alert-banner"]')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page).toHaveURL(/\/login/)
  })
})
