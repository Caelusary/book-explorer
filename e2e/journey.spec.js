import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockOpenLibrary } from './fixtures.js'

// Every test runs with Open Library mocked, and fails on any Content Security
// Policy violation (preview serves the production headers from vercel.json).
test.beforeEach(async ({ page }) => {
  page.cspViolations = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) {
      page.cspViolations.push(msg.text())
    }
  })
  await mockOpenLibrary(page)
})

test.afterEach(async ({ page }) => {
  expect(page.cspViolations).toEqual([])
})

/** Fails on serious or critical WCAG 2 A/AA violations on the current page. */
async function expectAccessible(page, where) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const bad = violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(bad.map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.help}`)).toEqual([])
}

/** Nothing on the page is wider than the viewport. */
async function expectNoSidewaysScroll(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test('lobby to results to book and back', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectAccessible(page, 'lobby')

  const input = page.getByRole('combobox', { name: 'Search books' })
  await input.fill('dune')

  // Live suggestions arrive once typing pauses.
  const suggestions = page.getByRole('listbox', { name: 'Search suggestions' })
  await expect(suggestions.getByRole('option', { name: /Dune Messiah/ })).toBeVisible()
  await expectAccessible(page, 'suggestions')

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/\/search\?q=dune$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('dune')
  await expect(page.getByRole('heading', { level: 2, name: '3 results' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Children of Dune' })).toBeVisible()

  // The near miss is kept, but below the grid rather than in it.
  const also = page.getByRole('region', { name: /others also searched for/i })
  await expect(also.getByText('The Desert Planet Companion')).toBeVisible()
  await expectNoSidewaysScroll(page)
  await expectAccessible(page, 'results')

  await page.getByLabel('Sort by').selectOption('new')
  await expect(page).toHaveURL(/sort=new/)
  await expect(page.getByRole('heading', { level: 2, name: '3 results' })).toBeVisible()

  await page.getByRole('link', { name: /^Cover of Dune\b|^Dune Frank Herbert/ }).first().click()
  await expect(page).toHaveURL(/\/book\/OL893415W$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Dune' })).toBeVisible()
  await expect(page.getByText('Science fiction')).toBeVisible()
  await expect(page.getByText('4.24 / 5')).toBeVisible()
  await expectNoSidewaysScroll(page)
  await expectAccessible(page, 'book')

  // Back returns to the exact result set, sort included.
  await page.getByRole('link', { name: 'Back to “dune”' }).click()
  await expect(page).toHaveURL(/\/search\?q=dune&sort=new$/)
  await expect(page.getByRole('heading', { level: 2, name: '3 results' })).toBeVisible()
})

test('a search with no matches says so', async ({ page }) => {
  await page.goto('/search?q=zzzz')
  await expect(page.getByText('No books found.')).toBeVisible()
  await expectAccessible(page, 'no results')
})

test('a query under three characters is explained without a request', async ({ page }) => {
  let searched = false
  page.on('request', (req) => {
    if (req.url().includes('/search.json')) searched = true
  })
  await page.goto('/search?q=ab')
  await expect(page.getByText(/at least 3 characters/i)).toBeVisible()
  expect(searched).toBe(false)
  await expectAccessible(page, 'short query')
})

test('a server error reads as English, not a status code', async ({ page }) => {
  let attempts = 0
  page.on('request', (req) => {
    if (req.url().includes('/search.json')) attempts += 1
  })
  await page.goto('/search?q=fail')
  await expect(page.getByRole('alert')).toContainText('Open Library is having trouble')
  await expectAccessible(page, 'server error')

  // "Try again" really asks again: failures are never served from the cache.
  const before = attempts
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect.poll(() => attempts).toBeGreaterThan(before)
})

test('a dropped connection says to check it', async ({ page }) => {
  await page.goto('/search?q=offline')
  await expect(page.getByRole('alert')).toContainText('Could not reach Open Library')
  await expectAccessible(page, 'offline')
})

test('the empty search page prompts for a query', async ({ page }) => {
  await page.goto('/search')
  await expect(page.getByText(/type something into the search box/i)).toBeVisible()
  await expectAccessible(page, 'empty search')
})

test('a book that fails to load offers a way back', async ({ page }) => {
  await page.goto('/book/OLFAILW')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible()
  await expectAccessible(page, 'book error')
})

test('a book with no cover or description still lays out', async ({ page }) => {
  await page.goto('/book/OL893527W')
  await expect(page.getByRole('heading', { level: 1, name: 'Children of Dune' })).toBeVisible()
  await expect(page.getByText('No cover')).toBeVisible()
  await expect(page.getByText('Not rated')).toBeVisible()
  await expectAccessible(page, 'bare book')
})

test('an unknown route shows the not-found page', async ({ page }) => {
  await page.goto('/nowhere')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expectAccessible(page, 'not found')
})

test('nothing scrolls sideways at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 })
  for (const path of ['/', '/search?q=dune', '/book/OL893415W', '/search?q=zzzz']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expectNoSidewaysScroll(page)
  }
})

test('every control on the results page is at least 44px tall', async ({ page }, testInfo) => {
  // A touch-target rule: with a mouse, the compact controls are deliberate.
  test.skip(testInfo.project.name !== 'phone', 'touch targets are a phone concern')
  await page.goto('/search?q=dune')
  await expect(page.getByRole('heading', { level: 2, name: '3 results' })).toBeVisible()
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, select, input, .back-link, .button-link')]
      .filter((el) => el.getBoundingClientRect().height < 44)
      .map((el) => el.outerHTML.slice(0, 80)),
  )
  expect(small).toEqual([])
})
