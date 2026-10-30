import { expect, test } from '@playwright/test'
import { capture, expectNoAxeViolations, rows } from './helpers'

test('captures notes, lists and tasks without an account, and keeps them after a reload', async ({
  page,
}) => {
  await page.goto('/app')
  await expect(page.getByText('A blank page.')).toBeVisible()

  await capture(page, 'Note', 'Paint the door\nThe green one')
  await capture(page, 'List', 'Groceries: milk, eggs, bread')
  await capture(page, 'Task', 'Call the vet')
  await expect(rows(page)).toHaveCount(3)
  await expect(rows(page).filter({ hasText: 'Groceries' })).toContainText(
    'milk, eggs, bread · 3 left',
  )

  await page.reload()
  await expect(rows(page)).toHaveCount(3)
  await expect(rows(page).filter({ hasText: 'Paint the door' })).toContainText(
    'The green one',
  )
})

test('opens a list, checks an entry and finds it again by search', async ({
  page,
}) => {
  await page.goto('/app')
  await capture(page, 'List', 'Packing: tent, stove')
  await rows(page).filter({ hasText: 'Packing' }).click()

  await page
    .getByRole('checkbox', { name: 'Check tent' })
    .check({ force: true })
  await expect(page.getByText('1 of 2 left')).toBeVisible()
  await expectNoAxeViolations(page)

  await page.goto('/app?q=stove')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page)).toContainText('Packing')
  await expectNoAxeViolations(page)
})

test('settings have no axe violations in the dark theme', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('radio', { name: 'Dark' }).check({ force: true })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoAxeViolations(page)
})

test('moves between items with j and k, and closes with Escape', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Keyboard navigation is for wide screens with a keyboard')
  await page.goto('/app')
  await capture(page, 'Note', 'First note')
  await capture(page, 'Note', 'Second note')
  await page.locator('body').click()

  // Newest first: Second, then First.
  await page.keyboard.press('j')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Second note' }),
  ).toBeAttached()
  await page.keyboard.press('j')
  await expect(
    page.getByRole('heading', { level: 1, name: 'First note' }),
  ).toBeAttached()
  await page.keyboard.press('k')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Second note' }),
  ).toBeAttached()

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/app$/)
  await expect(rows(page).filter({ hasText: 'Second note' })).toBeFocused()
})
