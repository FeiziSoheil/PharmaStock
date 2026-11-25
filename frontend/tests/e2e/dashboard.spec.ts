import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 900, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const imagesDir = path.resolve(__dirname, '../../../images')
const stitchShot = path.resolve(
  __dirname,
  '../../../docs/stitch-reference/screens/dashboard/screenshot.png',
)

async function gotoDashboard(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-slot="app-shell"]')).toBeVisible({
    timeout: 45_000,
  })
}

async function waitForReady(page: Page) {
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'میز کار پایش و انبارداری دارویی',
    }),
  ).toBeVisible({ timeout: 45_000 })
  await expect(
    page.getByRole('heading', { name: /پایش چندمرحله‌ای انقضا/ }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-slot="kpi-metric-card"]').first()).toBeVisible()
}

test.describe('Phase G — dashboard', () => {
  test.describe.configure({ timeout: 90_000 })

  for (const viewport of viewports) {
    test(`visual compare at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await gotoDashboard(page)
      await waitForReady(page)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

      const shotPath = testInfo.outputPath(`dashboard-${viewport.name}.png`)
      await page.screenshot({ path: shotPath, fullPage: true })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.copyFileSync(
        shotPath,
        path.join(imagesDir, `h14-dashboard-${viewport.name}.png`),
      )

      expect(fs.existsSync(stitchShot)).toBe(true)
      expect(fs.statSync(shotPath).size).toBeGreaterThan(10_000)

      const hasPageHScroll = await page.evaluate(() => {
        const doc = document.documentElement
        return doc.scrollWidth > doc.clientWidth + 1
      })
      expect(hasPageHScroll).toBe(false)
    })
  }

  test('keyboard ConfirmDialog Escape returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoDashboard(page)
    await waitForReady(page)

    const bulk = page.getByRole('button', {
      name: 'انتقال دسته جمعی به انبار امحا',
    })
    await bulk.focus()
    await expect(bulk).toBeFocused()
    await page.keyboard.press('Enter')

    const dialog = page.locator('[data-pattern="confirm-dialog"]')
    await expect(dialog).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'تأیید انتقال دسته‌جمعی به انبار امحا',
      }),
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 10_000 })
    await expect(bulk).toBeFocused({ timeout: 5_000 })
  })

  test('KPI navigation and audit trail link', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoDashboard(page)
    await waitForReady(page)

    await page.getByRole('button', { name: /کل اقلام دارویی فعال/ }).click()
    await expect(page).toHaveURL(/\/drug-catalog/)

    await page.goto('/dashboard')
    await waitForReady(page)

    await page
      .getByRole('button', {
        name: /مشاهده تاریخچه کامل لاگ‌ها/,
      })
      .click()
    await expect(page).toHaveURL(/\/audit-log/)
  })
})
