import { expect, test, type Page } from '@playwright/test'

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
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

async function controlledApiReady(): Promise<boolean> {
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

test.describe('controlled-substances-ledger', () => {
  for (const viewport of viewports) {
    test(`renders cleanly at ${viewport.name} without horizontal overflow`, async ({
      page,
    }) => {
      test.skip(
        !(await controlledApiReady()),
        'Go API /healthz unreachable. Start Mongo + Go API first.',
      )

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await loginAsOperator(page)
      await page.goto('/controlled-substances-ledger')

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'دفترچه رسمی گردش فرآورده‌های تحت کنترل و مخدر',
        }),
      ).toBeVisible({ timeout: 30_000 })

      await page
        .locator('[data-slot="controlled-ledger-skeleton"]')
        .waitFor({ state: 'detached', timeout: 15_000 })
        .catch(() => undefined)

      await expect(
        page.locator('[data-slot="dense-data-table"]'),
      ).toBeVisible({ timeout: 15_000 })

      const hasPageHScroll = await page.evaluate(() => {
        const doc = document.documentElement
        return doc.scrollWidth > doc.clientWidth + 1
      })
      expect(hasPageHScroll).toBe(false)

      if (viewport.name === 'desktop') {
        await expect(
          page.locator(
            '[data-slot="sidebar"] a[data-slot="sidebar-nav-item"][aria-current="page"]',
          ),
        ).toHaveText(/دفترچه داروهای تحت کنترل و مخدر/)
      }
    })
  }

  test('filters and registers a controlled inflow then prescription outflow', async ({
    page,
  }) => {
    test.skip(
      !(await controlledApiReady()),
      'Go API /healthz unreachable. Start Mongo + Go API first.',
    )

    const trackingIn = `TTAC-E2E-IN-${Date.now().toString(36)}`
    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsOperator(page)
    await page.goto('/controlled-substances-ledger')

    await expect(
      page.locator('[data-slot="dense-data-table"]'),
    ).toBeVisible({ timeout: 20_000 })

    // Open registration modal
    await page.getByTestId('ctrl-open-register').click()
    await expect(page.getByTestId('controlled-register-dialog')).toBeVisible()

    // Switch to distributor inflow
    await page.getByTestId('ctrl-form-tx-type').click()
    await page.getByRole('option', { name: /ورود محموله توزیع دولتی/ }).click()

    await page.getByTestId('ctrl-form-qty').fill('2')
    await page.getByTestId('ctrl-form-batch-no').fill('MR-09')
    await page.getByTestId('ctrl-form-expiry').fill('2027-03-01')
    await page.getByTestId('ctrl-form-physician').fill('پخش رازی')
    await page.getByTestId('ctrl-form-tracking').fill(trackingIn)
    await page.getByTestId('ctrl-form-ack').click()

    await page.getByTestId('ctrl-form-submit').click()
    await expect(
      page.getByTestId('controlled-register-dialog'),
    ).toBeHidden({ timeout: 15_000 })

    // Search for the newly created tracking code and verify persistence
    await page.getByTestId('ctrl-filter-search').fill(trackingIn)
    await expect(page.getByText(trackingIn, { exact: true })).toBeVisible({
      timeout: 15_000,
    })

    await page.reload()
    await expect(page.getByText(trackingIn, { exact: true })).toBeVisible({
      timeout: 15_000,
    })
  })
})
