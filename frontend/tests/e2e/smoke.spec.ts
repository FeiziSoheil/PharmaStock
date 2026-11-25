import { expect, test } from '@playwright/test'

test.describe('Phase A RTL & Self-Hosted Fonts Smoke', () => {
  test('redirects unauthenticated users to login and renders RTL html attributes, Persian heading, and loaded Vazirmatn + Inter fonts', async ({
    page,
  }, testInfo) => {
    await page.goto('/')

    const html = page.locator('html')
    await expect(html).toHaveAttribute('lang', 'fa')
    await expect(html).toHaveAttribute('dir', 'rtl')

    await expect(page).toHaveURL(/\/login$/)
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('ورود به انبار دارو')

    const rtlAndFonts = await page.evaluate(async () => {
      await document.fonts.ready
      const bodyStyle = getComputedStyle(document.body)
      const h1 = document.querySelector('h1')
      const latinSpan = document.querySelector('.font-latin')
      const loadedFamilies = Array.from(document.fonts)
        .filter((f) => f.status === 'loaded')
        .map((f) => f.family)

      return {
        direction: bodyStyle.direction,
        bodyFontFamily: bodyStyle.fontFamily,
        h1FontFamily: h1 ? getComputedStyle(h1).fontFamily : '',
        latinFontFamily: latinSpan ? getComputedStyle(latinSpan).fontFamily : '',
        loadedFamilies: Array.from(new Set(loadedFamilies)),
        vazirmatnLoaded: document.fonts.check('16px "Vazirmatn Variable"'),
        interLoaded: document.fonts.check('16px "Inter Variable"'),
      }
    })

    expect(rtlAndFonts.direction).toBe('rtl')
    expect(rtlAndFonts.bodyFontFamily).toContain('Vazirmatn Variable')
    expect(rtlAndFonts.latinFontFamily).toContain('Inter Variable')
    expect(rtlAndFonts.vazirmatnLoaded).toBe(true)
    expect(rtlAndFonts.interLoaded).toBe(true)

    await page.screenshot({
      path: testInfo.outputPath('phase-a-rtl-fonts.png'),
      fullPage: true,
    })
  })
})
