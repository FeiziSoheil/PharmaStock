import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

function isRestrainedShadow(value: string): boolean {
  if (!value || value === 'none') return true
  // Chromium often serializes CSS `none` custom-property shadows as a zero transparent shadow
  if (/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(value)) return true
  if (value.includes('0px 0px 0px 0px')) return true
  return false
}

async function assertRtlShell(page: Page) {
  const html = page.locator('html')
  await expect(html).toHaveAttribute('lang', 'fa')
  await expect(html).toHaveAttribute('dir', 'rtl')
  await expect(html).toHaveAttribute('data-theme', 'clinical-light')

  const direction = await page.evaluate(
    () => getComputedStyle(document.documentElement).direction,
  )
  expect(direction).toBe('rtl')
}

async function assertStitchVisualTokens(page: Page) {
  const metrics = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const button = document.querySelector(
      '[data-slot="button"][data-variant="default"]',
    )
    const card = document.querySelector('[data-slot="card"]')
    const badge = document.querySelector(
      '[data-slot="badge"][data-variant="valid"]',
    )
    const checkbox = document.querySelector('[data-slot="checkbox"]')
    const tableHead = document.querySelector('[data-slot="table-head"]')
    const tableRow = document.querySelector(
      '[data-slot="table-body"] [data-slot="table-row"]',
    )
    const breadcrumbSep = document.querySelector(
      '[data-slot="breadcrumb-separator"] .material-symbols-outlined',
    )

    return {
      primary: root.getPropertyValue('--ps-primary').trim(),
      radiusDefault: root.getPropertyValue('--ps-radius-default').trim(),
      radiusBadge: root.getPropertyValue('--ps-radius-badge').trim(),
      radiusCheckbox: root.getPropertyValue('--ps-radius-checkbox').trim(),
      radiusDialog: root.getPropertyValue('--ps-radius-dialog').trim(),
      level1Shadow: root.getPropertyValue('--ps-shadow-level-1').trim(),
      buttonBg: button ? getComputedStyle(button).backgroundColor : '',
      buttonRadius: button ? getComputedStyle(button).borderRadius : '',
      cardShadow: card ? getComputedStyle(card).boxShadow : '',
      cardBorder: card ? getComputedStyle(card).borderTopColor : '',
      badgeRadius: badge ? getComputedStyle(badge).borderRadius : '',
      checkboxRadius: checkbox ? getComputedStyle(checkbox).borderRadius : '',
      tableHeadAlign: tableHead ? getComputedStyle(tableHead).textAlign : '',
      tableRowHeight: tableRow ? getComputedStyle(tableRow).height : '',
      breadcrumbIcon: breadcrumbSep?.textContent?.trim() ?? '',
    }
  })

  // Stitch canonical tokens (DESIGN.md / design-system-spec)
  expect(metrics.primary).toBe('#0f766e')
  expect(metrics.radiusDefault).toBe('10px')
  expect(metrics.radiusBadge).toBe('9999px')
  expect(metrics.radiusCheckbox).toBe('4px')
  expect(metrics.radiusDialog).toBe('16px')
  expect(metrics.level1Shadow).toBe('none')

  expect(metrics.buttonBg).toBe('rgb(15, 118, 110)')
  expect(metrics.buttonRadius).toBe('10px')
  expect(isRestrainedShadow(metrics.cardShadow)).toBe(true)
  expect(metrics.cardBorder).toBe('rgb(226, 232, 240)') // #E2E8F0
  expect(metrics.badgeRadius).toBe('9999px')
  expect(metrics.checkboxRadius).toBe('4px')
  // Logical `text-start` may compute as `start` (modern Chromium) or physical `right` in RTL
  expect(['start', 'right']).toContain(metrics.tableHeadAlign)
  // design-system-spec: dense clinical rows ≈ 52px
  expect(Number.parseFloat(metrics.tableRowHeight)).toBeGreaterThanOrEqual(48)
  expect(Number.parseFloat(metrics.tableRowHeight)).toBeLessThanOrEqual(56)
  expect(metrics.breadcrumbIcon).toBe('chevron_left')
}

test.describe('Phase C Components Gallery', () => {
  for (const viewport of viewports) {
    test(`gallery renders at ${viewport.name} with RTL + Stitch tokens`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.goto('/components')

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /پیش‌نمایش اجزای پایه رابط کاربری/,
        }),
      ).toBeVisible()

      await assertRtlShell(page)
      await assertStitchVisualTokens(page)

      await page.keyboard.press('Tab')
      const focusedTag = await page.evaluate(
        () => document.activeElement?.tagName,
      )
      expect(focusedTag).toBeTruthy()

      const screenshotPath = path.join(
        'test-results',
        `phase-c-gallery-${viewport.name}.png`,
      )
      await page.screenshot({ path: screenshotPath, fullPage: true })
      await testInfo.attach(`gallery-${viewport.name}`, {
        path: screenshotPath,
        contentType: 'image/png',
      })
    })
  }

  test('sheet opens from physical left in RTL and dialog traps focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/components')

    const sheetTrigger = page.getByTestId('open-sheet')
    await sheetTrigger.scrollIntoViewIfNeeded()
    await sheetTrigger.click()

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet).toHaveAttribute('data-physical-side', 'left')
    await expect(
      sheet.getByRole('heading', { name: 'افزودن سری ساخت' }),
    ).toBeVisible()

    const sheetBox = await sheet.boundingBox()
    expect(sheetBox).toBeTruthy()
    if (sheetBox) {
      expect(sheetBox.x).toBeLessThan(40)
    }

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const dialogTrigger = page.getByTestId('open-dialog')
    await dialogTrigger.scrollIntoViewIfNeeded()
    await dialogTrigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('heading', { name: 'تأیید عملیات بحرانی' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('select and tabs respond to keyboard in RTL', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/components')

    const select = page.getByRole('combobox', { name: 'شرایط نگهداری' })
    await select.scrollIntoViewIfNeeded()
    await select.click()
    await expect(page.getByRole('listbox')).toBeVisible()
    await expect(page.getByRole('option', { name: /دمای اتاق/ })).toBeVisible()
    await page.keyboard.press('Escape')

    const stockTab = page.getByRole('tab', { name: 'موجودی' })
    await stockTab.scrollIntoViewIfNeeded()
    await stockTab.focus()
    // In RTL horizontal tabs, ArrowRight advances to the next DOM tab
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'انقضا' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
