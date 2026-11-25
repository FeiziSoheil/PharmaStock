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
  '../../../docs/stitch-reference/screens/auto-reorder-suggestions/screenshot.png',
)

async function gotoReorder(page: Page) {
  await page.goto('/auto-reorder-suggestions')
  await expect(page.locator('[data-slot="app-shell"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /پیشنهاد سفارش هوشمند دارو/,
    }),
  ).toBeVisible({ timeout: 30_000 })
}

async function waitForReady(page: Page) {
  await page
    .locator('[data-slot="auto-reorder-skeleton"]')
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => undefined)
  await expect(page.locator('[data-slot="dense-data-table"]').first()).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('Phase G Screen 5 — auto-reorder-suggestions', () => {
  for (const viewport of viewports) {
    test(`visual compare at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await gotoReorder(page)
      await waitForReady(page)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

      const shotPath = testInfo.outputPath(
        `auto-reorder-suggestions-${viewport.name}.png`,
      )
      await page.screenshot({ path: shotPath, fullPage: true })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.copyFileSync(
        shotPath,
        path.join(imagesDir, `h11-auto-reorder-${viewport.name}.png`),
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

  test('keyboard selection, inline edit, dialog focus trap and return', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoReorder(page)
    await waitForReady(page)

    const firstCheckbox = page
      .locator('[data-slot="dense-data-table"] [data-slot="checkbox"]')
      .first()
    await firstCheckbox.focus()
    await page.keyboard.press('Space')
    await expect(page.locator('[data-slot="reorder-selection-bar"]')).toBeVisible()

    const selectAll = page.getByRole('checkbox', {
      name: 'انتخاب تمامی اقلام این برگه',
    })
    await selectAll.focus()
    await page.keyboard.press('Space')

    const qtyInput = page
      .getByRole('textbox', { name: /تعداد سفارش/ })
      .first()
    await qtyInput.focus()
    await qtyInput.fill('۲۰')
    await qtyInput.press('Tab')

    const primary = page.getByRole('button', {
      name: 'صدور پیش‌فاکتور و ارسال به کارتابل خرید',
    })
    await primary.focus()
    await page.keyboard.press('Enter')

    const dialog = page.locator('[data-pattern="confirm-dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'انصراف' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      dialog.getByRole('button', { name: /تأیید/ }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 10_000 })
  })

  test('filters, chips, and controlled confirm note', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoReorder(page)
    await waitForReady(page)

    await page.getByLabel('جستجوی نام دارو در پیشنهادها').fill('مورفین')
    await expect(page.getByText(/جستجو:/)).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'پاک کردن همه' }).click()

    await page.getByLabel('فیلتر تحت کنترل').click()
    await page.getByRole('option', { name: 'فقط تحت کنترل' }).click()
    await waitForReady(page)

    const selectAll = page.getByRole('checkbox', {
      name: 'انتخاب تمامی اقلام این برگه',
    })
    await selectAll.click()
    await page
      .getByRole('button', { name: 'تبدیل اقلام انتخابی به سفارش خرید' })
      .click()
    const dialog = page.locator('[data-pattern="confirm-dialog"]')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(/قلم تحت کنترل \/ سهمیه‌ای/),
    ).toBeVisible()
  })
})
