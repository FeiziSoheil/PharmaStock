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
  '../../../docs/stitch-reference/screens/audit-log/screenshot.png',
)

async function gotoAudit(page: Page, query = '') {
  await page.goto(`/audit-log${query}`)
  await expect(page.locator('[data-slot="app-shell"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'گزارش و ممیزی رویدادهای سامانه (Audit Trail)',
    }),
  ).toBeVisible({ timeout: 30_000 })
}

async function waitForReady(page: Page) {
  await page
    .locator('[data-slot="audit-log-skeleton"]')
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => undefined)
}

test.describe('Phase G Screen 6 — audit-log', () => {
  for (const viewport of viewports) {
    test(`visual compare at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await gotoAudit(page)
      await waitForReady(page)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(
        page
          .locator(
            '[data-slot="dense-data-table"], [data-slot="alert-banner"], [data-slot="audit-log-skeleton"]',
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 })

      const shotPath = testInfo.outputPath(`audit-log-${viewport.name}.png`)
      await page.screenshot({ path: shotPath, fullPage: true })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.copyFileSync(
        shotPath,
        path.join(imagesDir, `h12-audit-log-${viewport.name}.png`),
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

  test('keyboard filters, table row, drawer Escape returns focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoAudit(page)
    await waitForReady(page)

    await page.getByLabel('شدت رویداد').click()
    await page.getByRole('option', { name: 'بحرانی' }).click()
    await expect(page).toHaveURL(/severity=critical/)

    await waitForReady(page)
    const firstRow = page.locator('[data-slot="dense-data-table"] [data-row-id]').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
    await firstRow.focus()
    await expect(firstRow).toBeFocused()
    await page.keyboard.press('Enter')

    const drawer = page.locator('[data-pattern="side-drawer"]')
    await expect(drawer).toBeVisible()
    await expect(page.locator('[data-slot="audit-event-drawer"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden({ timeout: 10_000 })
    await expect(firstRow).toBeFocused({ timeout: 5_000 })
  })

  test('export menu and removable chips', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoAudit(page, '?severity=critical')
    await waitForReady(page)

    await expect(page.getByText(/شدت: بحرانی/)).toBeVisible()
    await page.getByRole('button', { name: /حذف فیلتر شدت/ }).click()
    await expect(page).not.toHaveURL(/severity=critical/)

    await page.getByRole('button', { name: 'خروجی ممهور امنیتی' }).click()
    await expect(page.getByRole('menuitem', { name: /CSV/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /PDF/ })).toBeVisible()
  })
})
