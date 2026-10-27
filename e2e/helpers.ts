import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export const password = 'e2e-correct-horse-battery'

/** Test accounts share this prefix, so the teardown can find them. */
export const newEmail = () => `e2e-${crypto.randomUUID()}@example.com`

/**
 * Each test browser is its own visitor for the auth rate limits, which key on X-Forwarded-For
 * (the Tailscale sidecar sets it in production). Only auth requests get the header: the sync
 * service is another origin, and its CORS rules do not allow it.
 */
async function asOwnVisitor(page: Page) {
  const ip = `198.51.100.${Math.floor(Math.random() * 254) + 1}`
  await page.context().route('**/api/auth/**', (route) =>
    route.continue({
      headers: { ...route.request().headers(), 'x-forwarded-for': ip },
    }),
  )
}

export async function signUp(page: Page, name: string, email = newEmail()) {
  await asOwnVisitor(page)
  await page.goto('/sign-in')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('/')
  return email
}

export async function signIn(page: Page, email: string) {
  await asOwnVisitor(page)
  await page.goto('/sign-in?mode=sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/')
}

/** Types into the capture bar as the given type and saves with Enter. */
export async function capture(
  page: Page,
  type: 'Note' | 'List' | 'Task',
  text: string,
) {
  // The visible label, as a person would tap it (the radio input itself is hidden).
  await page
    .getByRole('radiogroup', { name: 'Type' })
    .getByText(type, { exact: true })
    .click()
  const field = page.getByRole('textbox', { name: `New ${type.toLowerCase()}` })
  await field.fill(text)
  await field.press('Enter')
  await expect(page.getByText(`${type} saved`)).toBeVisible()
}

/** The rows of the home list (titles with their detail line). */
export const rows = (page: Page) => page.locator('[role=main] li a')

export async function expectNoAxeViolations(page: Page) {
  // A toast fading in or out has partly transparent text, which axe reports as low contrast.
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
  const { violations } = await new AxeBuilder({ page })
    // React Aria's announcer keeps each message briefly, pointing at the element that said it;
    // after a client-side navigation that element can be gone before the message is.
    .exclude('[data-live-announcer]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`,
    ),
  ).toEqual([])
}
