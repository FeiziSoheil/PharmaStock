import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AMOX_GTIN = '6260001000001'
const API_BASE = (
  process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8080'
).replace(/\/$/, '')

function fromPersianDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) =>
    String(PERSIAN_DIGITS.indexOf(digit)),
  )
}

async function loginAsOperator(page: Page) {
  await page.goto('/login')
  await expect(page.locator('[data-slot="login-page"]')).toBeVisible({
    timeout: 30_000,
  })
  await page.locator('#login-username').fill('operator')
  await page.locator('#login-password').fill('change-me-demo-only')
  const challenge = page.locator('[data-slot="login-captcha-challenge"]')
  await expect(challenge).toHaveAttribute('data-ready', 'true')
  const digits = await challenge.locator('span').allTextContents()
  await page.locator('#login-captcha').fill(fromPersianDigits(digits.join('')))
  await page.getByRole('button', { name: 'ادامه به فضای کاری' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
}

/** Cache-only smoke needs Mongo + API. Skip instead of failing when they are down. */
async function ttacApiReady(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/healthz`, {
      signal: AbortSignal.timeout(2_000),
    })
    return res.ok
  } catch {
    return false
  }
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 900, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const imagesDir = path.resolve(__dirname, '../../../images')
const stitchShot = path.resolve(
  __dirname,
  '../../../docs/stitch-reference/screens/drug-catalog/screenshot.png',
)

async function gotoCatalog(page: Page) {
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
}

test.describe('Phase G Screen 1 — drug-catalog', () => {
  for (const viewport of viewports) {
    test(`visual compare at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await gotoCatalog(page)

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(page.locator('[data-slot="app-shell"]')).toBeVisible()

      // Wait for table or empty/error states after mock latency
      await expect(
        page
          .locator('[data-slot="dense-data-table"], [data-slot="alert-banner"], [data-slot="drug-catalog-skeleton"]')
          .first(),
      ).toBeVisible({ timeout: 15_000 })

      await page
        .locator('[data-slot="drug-catalog-skeleton"]')
        .waitFor({ state: 'detached', timeout: 15_000 })
        .catch(() => undefined)

      const shotPath = testInfo.outputPath(`drug-catalog-${viewport.name}.png`)
      await page.screenshot({ path: shotPath, fullPage: true })

      fs.mkdirSync(imagesDir, { recursive: true })
      fs.copyFileSync(
        shotPath,
        path.join(imagesDir, `h7-drug-catalog-${viewport.name}.png`),
      )

      // Soft visual anchor: Stitch reference exists and our shot is non-trivial
      expect(fs.existsSync(stitchShot)).toBe(true)
      const stats = fs.statSync(shotPath)
      expect(stats.size).toBeGreaterThan(10_000)

      if (viewport.name === 'desktop') {
        const sidebar = page.locator('[data-slot="sidebar"]')
        await expect(sidebar).toBeVisible()
        await expect(
          page.locator('[data-slot="sidebar"] a[data-slot="sidebar-nav-item"][aria-current="page"]'),
        ).toHaveText(/کاتالوگ دارو/)
      }
    })
  }

  test('keyboard navigation through table and drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoCatalog(page)

    await page
      .locator('[data-slot="drug-catalog-skeleton"]')
      .waitFor({ state: 'detached', timeout: 15_000 })
      .catch(() => undefined)

    await expect(page.locator('[data-slot="dense-data-table"]')).toBeVisible({
      timeout: 15_000,
    })

    const createBtn = page.getByRole('button', { name: 'تعریف داروی جدید +' })
    await createBtn.focus()
    await expect(createBtn).toBeFocused()
    await page.keyboard.press('Enter')

    const drawer = page.locator('[data-pattern="side-drawer"]')
    await expect(drawer).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'ثبت داروی جدید در کاتالوگ انبار' }),
    ).toBeVisible()

    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    const ttacInput = page.getByLabel('کد استعلام تی‌تک')
    await ttacInput.focus()
    await ttacInput.fill('06260123456789')
    await page.getByRole('button', { name: 'استعلام تی‌تک' }).click()
    await expect(page.getByText(/یافته‌شده در سامانه غذا و دارو/)).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: /درج خودکار در فرم/ }).click()
    await expect(page.locator('#drug-nameFa')).toHaveValue(/متفورمین/)

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden({ timeout: 10_000 })

    // Table row keyboard open
    const firstRow = page.locator('[data-slot="dense-data-table"] tbody tr').first()
    await firstRow.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-pattern="side-drawer"]')).toBeVisible()
  })

  test('search filter chips and clear-all', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoCatalog(page)
    await page
      .locator('[data-slot="dense-data-table"]')
      .waitFor({ state: 'visible', timeout: 15_000 })

    const search = page.getByLabel('جستجوی کاتالوگ دارو')
    await search.fill('متفورمین')
    await expect(page.getByText(/جستجو: متفورمین/)).toBeVisible({
      timeout: 5_000,
    })
    await page.getByRole('button', { name: 'پاکسازی همه فیلترها' }).click()
    await expect(page.getByText('بدون فیلتر')).toBeVisible()
  })
})

test.describe('TTAC cache-only lookup', () => {
  // API must allow this page’s origin (Playwright default baseURL is http://127.0.0.1:3001).
  // Cache-only: TTAC_ENABLED=false + SEED_ON_START=true so AMOX_GTIN hits ttac_cache, not live TTAC.
  test('TTAC lookup from cache fills preview', async ({ page }) => {
    test.skip(
      !(await ttacApiReady()),
      'Go API /healthz unreachable (or wrong host). Start Mongo+API with TTAC_ENABLED=false, SEED_ON_START=true, CORS_ORIGINS including http://127.0.0.1:3001, then Next/webServer. Manual checklist: task-9 report.',
    )

    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)
    await page.goto('/drug-catalog')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'کاتالوگ جامع دارو و اقلام ژنریک',
      }),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'تعریف داروی جدید +' }).click()
    const query = page.getByTestId('ttac-query')
    await expect(query).toBeVisible()
    await query.fill(AMOX_GTIN)
    const lookupResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/ttac/lookup') &&
        res.request().method() === 'GET',
    )
    await page.getByTestId('ttac-lookup').click()
    const lookupResponse = await lookupResponsePromise
    const lookupJson = (await lookupResponse.json()) as {
      product?: { fromCache?: boolean }
    }
    expect(lookupJson.product?.fromCache).toBe(true)

    await expect(
      page.getByText(/یافته‌شده در سامانه غذا و دارو:\s*آموکسی‌سیلین/),
    ).toBeVisible({ timeout: 15_000 })
  })
})
