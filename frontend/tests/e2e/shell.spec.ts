import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 900, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const imagesDir = path.resolve(__dirname, '../../../images')

async function assertRtlShell(page: Page) {
  const html = page.locator('html')
  await expect(html).toHaveAttribute('lang', 'fa')
  await expect(html).toHaveAttribute('dir', 'rtl')
  const direction = await page.evaluate(
    () => getComputedStyle(document.documentElement).direction,
  )
  expect(direction).toBe('rtl')
}

test.describe('Phase D Shared Shell Gallery', () => {
  for (const viewport of viewports) {
    test(`shell gallery at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.goto('/shell')

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /پیش‌نمایش پوسته و اجزای مشترک/,
        }),
      ).toBeVisible()

      await assertRtlShell(page)

      const shell = page.locator('[data-slot="app-shell"]')
      await expect(shell).toBeVisible()

      if (viewport.name === 'desktop') {
        await expect(shell).toHaveAttribute('data-layout-mode', 'desktop')
        await expect(shell).toHaveAttribute('data-sidebar-collapsed', 'false')
        const sidebar = page.locator('[data-slot="sidebar"]')
        await expect(sidebar).toBeVisible()
        const box = await sidebar.boundingBox()
        expect(box).toBeTruthy()
        if (box) {
          // RTL: sidebar anchored to physical right
          expect(box.x + box.width).toBeGreaterThan(viewport.width - 8)
          expect(Math.round(box.width)).toBeGreaterThanOrEqual(250)
          expect(Math.round(box.width)).toBeLessThanOrEqual(270)
        }
        const header = page.locator('[data-slot="top-header"]')
        const headerBox = await header.boundingBox()
        expect(headerBox?.height).toBeGreaterThanOrEqual(60)
        expect(headerBox?.height).toBeLessThanOrEqual(68)
      }

      if (viewport.name === 'tablet') {
        await expect(shell).toHaveAttribute('data-layout-mode', 'tablet')
        await expect(shell).toHaveAttribute('data-sidebar-collapsed', 'true')
        const sidebar = page.locator('[data-slot="sidebar"]')
        const box = await sidebar.boundingBox()
        expect(box).toBeTruthy()
        if (box) {
          expect(Math.round(box.width)).toBeGreaterThanOrEqual(68)
          expect(Math.round(box.width)).toBeLessThanOrEqual(80)
        }
      }

      if (viewport.name === 'mobile') {
        await expect(shell).toHaveAttribute('data-layout-mode', 'mobile')
        await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0)
        await page.getByRole('button', { name: 'باز کردن منو' }).click()
        const mobileNav = page.locator('[data-slot="app-shell-mobile-nav"]')
        await expect(mobileNav).toBeVisible()
        // side=start → physical right in RTL
        await expect(mobileNav).toHaveAttribute('data-physical-side', 'right')
        const navBox = await mobileNav.boundingBox()
        expect(navBox).toBeTruthy()
        if (navBox) {
          expect(navBox.x + navBox.width).toBeGreaterThan(viewport.width - 8)
        }
        await page.keyboard.press('Escape')
      }

      // Shared components present
      await expect(page.locator('[data-slot="kpi-metric-card"]').first()).toBeVisible()
      await expect(page.locator('[data-slot="dense-data-table"]')).toBeVisible()
      await expect(page.locator('[data-slot="triage-status-badge"]').first()).toBeVisible()
      await expect(page.locator('[data-slot="pagination"]')).toBeVisible()

      const statusValid = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement)
        return {
          validFg: root.getPropertyValue('--ps-status-valid-fg').trim(),
          sidebar: root.getPropertyValue('--ps-sidebar-width').trim(),
          collapsed: root.getPropertyValue('--ps-sidebar-collapsed-width').trim(),
          header: root.getPropertyValue('--ps-header-height').trim(),
        }
      })
      expect(statusValid.validFg).toBe('#059669')
      expect(statusValid.sidebar).toBe('260px')
      expect(statusValid.collapsed).toBe('72px')
      expect(statusValid.header).toBe('64px')

      fs.mkdirSync(imagesDir, { recursive: true })
      const shotName = `h4-phase-d-shell-${viewport.name}.png`
      const shotPath = path.join(imagesDir, shotName)
      const localShot = path.join('test-results', `phase-d-shell-${viewport.name}.png`)
      await page.screenshot({ path: localShot, fullPage: true })
      await page.screenshot({ path: shotPath, fullPage: true })
      await testInfo.attach(`shell-${viewport.name}`, {
        path: shotPath,
        contentType: 'image/png',
      })
    })
  }

  test('confirm dialog and side drawer RTL placement', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/shell')

    await page.getByTestId('open-confirm').click()
    const confirm = page.getByRole('dialog')
    await expect(confirm).toBeVisible()
    await expect(
      confirm.getByRole('heading', { name: 'حذف دائمی سری ساخت؟' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByTestId('open-drawer').click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer).toHaveAttribute('data-physical-side', 'left')
    const box = await drawer.boundingBox()
    expect(box).toBeTruthy()
    if (box) {
      expect(box.x).toBeLessThan(40)
    }
    await expect(
      drawer.getByRole('heading', { name: 'افزودن سریع سری ساخت' }),
    ).toBeVisible()
  })

  test('collapsed desktop rail shows tooltip on focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/shell')

    await page.getByRole('button', { name: 'جمع کردن نوار کناری' }).click()
    await expect(page.locator('[data-slot="app-shell"]')).toHaveAttribute(
      'data-sidebar-collapsed',
      'true',
    )

    const inventoryLink = page.getByRole('link', { name: 'لیست و موجودی' })
    await inventoryLink.focus()
    await expect(page.getByRole('tooltip', { name: 'لیست و موجودی' })).toBeVisible({
      timeout: 3000,
    })
  })
})
