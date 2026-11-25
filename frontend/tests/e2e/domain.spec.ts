import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 900, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const imagesDir = path.resolve(__dirname, '../../../images')

async function assertRtl(page: Page) {
  const html = page.locator('html')
  await expect(html).toHaveAttribute('lang', 'fa')
  await expect(html).toHaveAttribute('dir', 'rtl')
  const direction = await page.evaluate(
    () => getComputedStyle(document.documentElement).direction,
  )
  expect(direction).toBe('rtl')
}

test.describe('Phase E Domain Components Gallery', () => {
  for (const viewport of viewports) {
    test(`domain gallery at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.goto('/domain')

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /پیش‌نمایش کامپوننت‌های دامنه انبار دارو/,
        }),
      ).toBeVisible()

      await assertRtl(page)

      await expect(page.locator('[data-slot="stepper"]')).toBeVisible()
      await expect(page.locator('[data-slot="file-dropzone"]')).toBeVisible()
      await expect(page.locator('[data-slot="kardex-timeline"]')).toBeVisible()
      await expect(page.locator('[data-slot="warehouse-rack-grid"]')).toBeVisible()
      await expect(page.locator('[data-slot="rbac-permission-matrix"]')).toBeVisible()
      await expect(page.locator('[data-slot="printable-document-preview"]')).toBeVisible()
      await expect(page.locator('[data-slot="printable-area"]')).toBeVisible()

      // Stitch token presence (Phase B bridge)
      const primary = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--ps-primary').trim(),
      )
      expect(primary.length).toBeGreaterThan(0)

      const shot = await page.screenshot({ fullPage: true })
      await testInfo.attach(`domain-${viewport.name}`, {
        body: shot,
        contentType: 'image/png',
      })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.writeFileSync(
        path.join(imagesDir, `h5-phase-e-domain-${viewport.name}.png`),
        shot,
      )
    })
  }

  test('print preview toolbar and printable area', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/domain')

    const preview = page.locator('[data-slot="printable-document-preview"]')
    await expect(preview).toBeVisible()
    await expect(page.locator('[data-slot="printable-area"]')).toBeVisible()

    const printBtn = page.getByRole('button', { name: /چاپ/ })
    await expect(printBtn).toBeVisible()

    // Toolbar should be marked print:hidden (class contains print:hidden)
    const toolbarHidden = await printBtn.evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement
      while (node) {
        if (node.className?.toString().includes('print:hidden')) return true
        node = node.parentElement
      }
      return false
    })
    expect(toolbarHidden).toBe(true)

    const areaDir = await page
      .locator('[data-slot="printable-area"]')
      .evaluate((el) => el.getAttribute('dir') || getComputedStyle(el).direction)
    expect(areaDir === 'rtl' || areaDir === '').toBeTruthy()
  })

  test('rack grid keyboard and matrix checkbox interaction', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/domain')

    const grid = page.locator('[data-slot="warehouse-rack-grid"]')
    await expect(grid).toBeVisible()
    const cell = grid.locator('[role="gridcell"]').first()
    await cell.focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    const matrix = page.locator('[data-slot="rbac-permission-matrix"]')
    const checkbox = matrix.getByRole('checkbox').first()
    await checkbox.focus()
    await expect(checkbox).toBeFocused()
  })
})
