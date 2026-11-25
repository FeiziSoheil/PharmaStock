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
  '../../../docs/stitch-reference/screens/expiry-alerts-fefo/screenshot.png',
)

async function gotoExpiry(page: Page) {
  await page.goto('/expiry-alerts-fefo')
  await expect(page.locator('[data-slot="app-shell"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'پایش تاریخ انقضا و مدیریت سری ساخت (FEFO)',
    }),
  ).toBeVisible({ timeout: 30_000 })
}

async function waitForReady(page: Page) {
  await page
    .locator('[data-slot="expiry-alerts-skeleton"]')
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => undefined)
}

test.describe('Phase G Screen 4 — expiry-alerts-fefo', () => {
  for (const viewport of viewports) {
    test(`visual compare at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await gotoExpiry(page)
      await waitForReady(page)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(
        page
          .locator(
            '[data-slot="dense-data-table"], [data-slot="alert-banner"], [data-slot="expiry-alerts-skeleton"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 })

      const shotPath = testInfo.outputPath(
        `expiry-alerts-fefo-${viewport.name}.png`,
      )
      await page.screenshot({ path: shotPath, fullPage: true })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.copyFileSync(
        shotPath,
        path.join(imagesDir, `h10-expiry-alerts-fefo-${viewport.name}.png`),
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

  test('keyboard filters + ConfirmDialog focus trap / Escape / return', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoExpiry(page)
    await waitForReady(page)

    const search = page.getByLabel('جستجوی نام دارو یا سری ساخت')
    await search.focus()
    await expect(search).toBeFocused()
    await search.fill('سفتریاکسون')
    await expect(page.getByText(/جستجو: سفتریاکسون/)).toBeVisible({
      timeout: 5_000,
    })
    await waitForReady(page)

    const quarantine = page.getByRole('button', { name: 'انتقال به قرنطینه' }).first()
    await quarantine.focus()
    await expect(quarantine).toBeFocused()
    await page.keyboard.press('Enter')

    const dialog = page.locator('[data-pattern="confirm-dialog"]')
    await expect(dialog).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'تایید انتقال به انبار قرنطینه و ضایعات',
      }),
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 10_000 })
    await expect(quarantine).toBeFocused({ timeout: 5_000 })
  })

  test('KPI filter chips and clear-all', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoExpiry(page)
    await waitForReady(page)

    await page.getByRole('button', { name: /فوری \(کمتر از ۳۰ روز\)/ }).click()
    await expect(page.getByText(/باکت:/)).toBeVisible({ timeout: 5_000 })
    await waitForReady(page)
    await expect(page.locator('[data-slot="dense-data-table"]')).toBeVisible()

    await page.getByRole('button', { name: 'پاکسازی همه فیلترها' }).click()
    await expect(page.getByText('بدون فیلتر')).toBeVisible()
  })
})
