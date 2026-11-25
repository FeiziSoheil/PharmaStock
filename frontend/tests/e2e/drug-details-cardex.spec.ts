import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const imagesDir = path.resolve(__dirname, '../../../images')
const stitchShot = path.resolve(
  __dirname,
  '../../../docs/stitch-reference/screens/drug-details-cardex/screenshot.png',
)

async function gotoDrugDetails(page: Page, query = '?drugId=drug-amox') {
  await page.goto(`/drug-details-cardex${query}`)
  await expect(page.locator('[data-slot="app-shell"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /جزئیات (دارو و کاردکس|فرآورده:)/,
    }),
  ).toBeVisible({ timeout: 30_000 })
}

async function waitForReady(page: Page) {
  await page
    .locator('[data-slot="drug-details-skeleton"]')
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => undefined)
}

test.describe('Phase G Screen 7 — drug-details-cardex', () => {
  for (const viewport of viewports) {
    test(`visual compare at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await gotoDrugDetails(page)
      await waitForReady(page)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /جزئیات فرآورده: متفورمین هیدروکلراید/,
        }),
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        page
          .locator(
            '[data-slot="dense-data-table"], [data-slot="alert-banner"], [data-slot="drug-details-skeleton"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 })

      const shotPath = testInfo.outputPath(
        `drug-details-cardex-${viewport.name}.png`,
      )
      await page.screenshot({ path: shotPath, fullPage: true })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.copyFileSync(
        shotPath,
        path.join(imagesDir, `h13-drug-details-${viewport.name}.png`),
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

  test('catalog drug name navigates with drugId', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/drug-catalog')
    await expect(page.locator('[data-slot="app-shell"]')).toBeVisible({
      timeout: 30_000,
    })
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'کاتالوگ جامع دارو و اقلام ژنریک',
      }),
    ).toBeVisible({ timeout: 30_000 })
    await page
      .locator('[data-slot="drug-catalog-skeleton"]')
      .waitFor({ state: 'detached', timeout: 15_000 })
      .catch(() => undefined)

    const search = page.getByLabel('جستجوی کاتالوگ دارو')
    await search.fill('متفورمین')
    await expect(
      page.getByRole('link', { name: /متفورمین هیدروکلراید/ }).first(),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: /متفورمین هیدروکلراید/ }).first().click()
    await expect(page).toHaveURL(/\/drug-details-cardex\?.*drugId=/)
    await waitForReady(page)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /جزئیات فرآورده: متفورمین هیدروکلراید/,
      }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('cardex tab updates URL and shows timeline + table', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoDrugDetails(page)
    await waitForReady(page)

    await page
      .getByRole('tab', { name: /گردش موجودی و کاردکس انبار/ })
      .click()
    await expect(page).toHaveURL(/tab=cardex/)
    await expect(page.locator('[data-slot="kardex-timeline"]')).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText('کاردکس انبار و ثبت رویدادهای فیزیکی'),
    ).toBeVisible()
    await expect(page.locator('[data-slot="dense-data-table"]')).toBeVisible()
  })

  test('keyboard add-batch drawer Escape returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoDrugDetails(page)
    await waitForReady(page)

    const addBatch = page.getByRole('button', {
      name: 'ثبت ورود سری ساخت (بچ) جدید',
    })
    await addBatch.focus()
    await expect(addBatch).toBeFocused()
    await page.keyboard.press('Enter')

    const drawer = page.locator('[data-pattern="side-drawer"]')
    await expect(drawer).toHaveAttribute('data-state', 'open', {
      timeout: 10_000,
    })
    await expect(
      page.getByRole('heading', { name: 'ثبت ورود سری ساخت (بچ) جدید' }),
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(drawer).toHaveAttribute('data-state', 'closed', {
      timeout: 10_000,
    })
    await expect(addBatch).toBeFocused({ timeout: 5_000 })
  })
})
