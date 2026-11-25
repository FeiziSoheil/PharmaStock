import { expect, test } from '@playwright/test'

test.describe('Phase B Design Tokens & Material Symbols Preview', () => {
  test('resolves CSS variables, Tailwind v4 utilities, preserved Stitch status colors, and local Material Symbols glyphs', async ({
    page,
  }, testInfo) => {
    await page.goto('/tokens')

    const html = page.locator('html')
    await expect(html).toHaveAttribute('lang', 'fa')
    await expect(html).toHaveAttribute('dir', 'rtl')
    await expect(html).toHaveAttribute('data-theme', 'clinical-light')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('پیش‌نمایش توکن‌ها و آیکون‌های انبار دارو')

    const tokenChecks = await page.evaluate(async () => {
      await document.fonts.ready
      const rootStyle = getComputedStyle(document.documentElement)
      const bodyStyle = getComputedStyle(document.body)

      const primarySwatch = document.querySelector('[data-token-swatch="--ps-primary"] > div')
      const expiringBadge = document.querySelector('[data-status-badge="expiring"]')
      const defaultRadiusCard = document.querySelector('[data-radius-sample="--ps-radius-default"]')
      const checkboxRadiusCard = document.querySelector('[data-radius-sample="--ps-radius-checkbox"]')
      const dialogRadiusCard = document.querySelector('[data-radius-sample="--ps-radius-dialog"]')
      const badgeRadiusCard = document.querySelector('[data-radius-sample="--ps-radius-badge"]')
      const level1Card = document.querySelector('[data-elevation="level-1"]')
      const level3Card = document.querySelector('[data-elevation="level-3"]')

      const iconNodes = Array.from(document.querySelectorAll('.material-symbols-outlined'))
      const iconMeasurements = iconNodes.map((el) => {
        const style = getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize) || 20
        return {
          requested: el.getAttribute('data-icon-requested'),
          resolved: el.getAttribute('data-icon-resolved'),
          scrollWidth: (el as HTMLElement).scrollWidth,
          fontSize,
        }
      })

      return {
        bodyBg: bodyStyle.backgroundColor,
        cssPrimary: rootStyle.getPropertyValue('--ps-primary').trim(),
        cssSidebarWidth: rootStyle.getPropertyValue('--ps-sidebar-width').trim(),
        cssHeaderHeight: rootStyle.getPropertyValue('--ps-header-height').trim(),
        primarySwatchBg: primarySwatch ? getComputedStyle(primarySwatch).backgroundColor : '',
        expiringFg: expiringBadge ? getComputedStyle(expiringBadge).color : '',
        expiringBg: expiringBadge ? getComputedStyle(expiringBadge).backgroundColor : '',
        defaultRadius: defaultRadiusCard ? getComputedStyle(defaultRadiusCard).borderRadius : '',
        checkboxRadius: checkboxRadiusCard ? getComputedStyle(checkboxRadiusCard).borderRadius : '',
        dialogRadius: dialogRadiusCard ? getComputedStyle(dialogRadiusCard).borderRadius : '',
        badgeRadius: badgeRadiusCard ? getComputedStyle(badgeRadiusCard).borderRadius : '',
        level1Shadow: level1Card ? getComputedStyle(level1Card).boxShadow : '',
        level3Shadow: level3Card ? getComputedStyle(level3Card).boxShadow : '',
        materialSymbolsLoaded: document.fonts.check('20px "Material Symbols Outlined"'),
        iconMeasurements,
      }
    })

    // #f8fafc -> rgb(248, 250, 252)
    expect(tokenChecks.bodyBg).toBe('rgb(248, 250, 252)')
    expect(tokenChecks.cssPrimary).toBe('#0f766e')
    expect(tokenChecks.cssSidebarWidth).toBe('260px')
    expect(tokenChecks.cssHeaderHeight).toBe('64px')

    // #0f766e -> rgb(15, 118, 110)
    expect(tokenChecks.primarySwatchBg).toBe('rgb(15, 118, 110)')
    // Preserved Stitch expiring colors: #ea580c / #fff7ed
    expect(tokenChecks.expiringFg).toBe('rgb(234, 88, 12)')
    expect(tokenChecks.expiringBg).toBe('rgb(255, 247, 237)')

    // Radii tokens
    expect(tokenChecks.defaultRadius).toBe('10px')
    expect(tokenChecks.checkboxRadius).toBe('4px')
    expect(tokenChecks.dialogRadius).toBe('16px')
    expect(tokenChecks.badgeRadius).toBe('9999px')

    // Restrained elevation
    expect(tokenChecks.level1Shadow).toBe('none')
    expect(tokenChecks.level3Shadow).not.toBe('none')

    // Material Symbols Outlined local font + ligature glyph rendering check
    expect(tokenChecks.materialSymbolsLoaded).toBe(true)
    expect(tokenChecks.iconMeasurements.length).toBeGreaterThanOrEqual(20)
    for (const icon of tokenChecks.iconMeasurements) {
      expect(
        icon.scrollWidth,
        `Icon "${icon.requested}" (${icon.resolved}) did not collapse into a ligature glyph`,
      ).toBeLessThanOrEqual(icon.fontSize * 1.5)
    }

    await page.screenshot({
      path: testInfo.outputPath('phase-b-tokens-preview.png'),
      fullPage: true,
    })
  })
})
