import { expect, test } from '@playwright/test'
import { expectNoAxeViolations } from './helpers'

test('the public pages render without axe violations and lead into the app', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'One calm place',
  )
  await expectNoAxeViolations(page)

  for (const [link, heading] of [
    ['Privacy', 'Privacy policy'],
    ['Terms', 'Terms of use'],
    ['Accessibility', 'Accessibility'],
  ]) {
    await page
      .getByRole('navigation', { name: 'Legal' })
      .getByRole('link', { name: link })
      .click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    await expectNoAxeViolations(page)
  }

  await page.getByRole('link', { name: 'Open Oriel' }).first().click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText('A blank page.')).toBeVisible()
})

test('a device that has used the notebook opens it straight from the home page', async ({
  page,
}) => {
  await page.goto('/app')
  await expect(page.getByText('A blank page.')).toBeVisible()

  await page.goto('/')
  await expect(page).toHaveURL(/\/app$/)
})
