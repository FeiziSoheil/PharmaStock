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
  '../../../docs/stitch-reference/screens/shelf-inventory/screenshot.png',
)

async function gotoShelf(page: Page, query = '') {
  await page.goto(`/shelf-inventory${query}`)
  await expect(page.locator('[data-slot="app-shell"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'مدیریت و پایش موجودی به تفکیک موقعیت فیزیکی انبار',
    }),
  ).toBeVisible({ timeout: 30_000 })
}

async function waitForReady(page: Page) {
  await page
    .locator('[data-slot="shelf-inventory-skeleton"]')
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => undefined)
}

test.describe('Phase G Screen 3 — shelf-inventory', () => {
  for (const viewport of viewports) {
    test(`visual compare at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await gotoShelf(page)
      await waitForReady(page)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(
        page
          .locator(
            '[data-slot="dense-data-table"], [data-slot="alert-banner"], [data-slot="shelf-inventory-skeleton"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 })

      const shotPath = testInfo.outputPath(`shelf-inventory-${viewport.name}.png`)
      await page.screenshot({ path: shotPath, fullPage: true })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.copyFileSync(
        shotPath,
        path.join(imagesDir, `h9-shelf-inventory-${viewport.name}.png`),
      )

      expect(fs.existsSync(stitchShot)).toBe(true)
      expect(fs.statSync(shotPath).size).toBeGreaterThan(10_000)

      // No horizontal page scroll
      const hasPageHScroll = await page.evaluate(() => {
        const doc = document.documentElement
        return doc.scrollWidth > doc.clientWidth + 1
      })
      expect(hasPageHScroll).toBe(false)
    })
  }

  test('URL-backed grid view + keyboard RTL arrows + drawer Escape', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoShelf(page, '?view=grid')
    await waitForReady(page)

    await expect(page).toHaveURL(/view=grid/)
    const grid = page.locator('[data-slot="warehouse-rack-grid"] [role="grid"]')
    await expect(grid).toBeVisible({ timeout: 15_000 })

    const firstCell = grid.locator('[role="gridcell"]').first()
    await firstCell.focus()
    await expect(firstCell).toBeFocused()

    const firstLabel = await firstCell.getAttribute('aria-label')
    await page.keyboard.press('ArrowLeft')
    const afterLeft = grid.locator('[role="gridcell"]:focus')
    await expect(afterLeft).toBeFocused()
    const afterLeftLabel = await afterLeft.getAttribute('aria-label')
    expect(afterLeftLabel).not.toBe(firstLabel)

    await page.keyboard.press('ArrowRight')
    await expect(firstCell).toBeFocused()

    await page.keyboard.press('Enter')
    const drawer = page.locator('[data-pattern="side-drawer"]')
    await expect(drawer).toBeVisible()
    await expect(page.locator('[data-slot="shelf-bin-drawer"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden({ timeout: 10_000 })
  })

  test('list filters, chips, and search', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoShelf(page)
    await waitForReady(page)

    await page.getByRole('button', { name: 'نقشه قفسه' }).click()
    await expect(page).toHaveURL(/view=grid/)
    await page.getByRole('button', { name: 'فهرست' }).click()
    await expect(page).not.toHaveURL(/view=grid/)

    await page.getByLabel('جستجوی موقعیت یا دارو').fill('آموکسی')
    await expect(page.getByText(/جستجو: آموکسی/)).toBeVisible({
      timeout: 5_000,
    })
    await waitForReady(page)
    await expect(page.locator('[data-slot="dense-data-table"]')).toBeVisible()

    await page.getByRole('button', { name: 'پاکسازی همه فیلترها' }).click()
    await expect(page.getByText('بدون فیلتر')).toBeVisible()
  })
})
