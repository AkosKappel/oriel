import { expect, test } from '@playwright/test'
import { capture, expectNoAxeViolations, rows, signUp } from './helpers'

test('a viewer joins a shared space by link and sees it read-only', async ({
  browser,
}) => {
  const owner = await (await browser.newContext()).newPage()
  const viewer = await (await browser.newContext()).newPage()
  const spaceName = `Family ${Date.now()}`

  await signUp(owner, 'Anna')
  await owner.goto('/spaces')
  await owner.getByLabel('New shared space').fill(spaceName)
  await owner.getByRole('button', { name: 'Create' }).click()
  await owner.getByRole('link', { name: spaceName }).click()
  await expect(
    owner.getByRole('heading', { level: 1, name: spaceName }),
  ).toBeAttached()
  const spaceId = owner.url().split('/spaces/')[1]

  await owner.getByRole('radio', { name: 'Only view' }).check({ force: true })
  await owner.getByRole('button', { name: 'Create invite link' }).click()
  const link = await owner.getByLabel('Invite link').inputValue()
  await expectNoAxeViolations(owner)

  await owner.goto(`/?space=${spaceId}`)
  await capture(owner, 'Note', 'Dinner on Sunday')

  await signUp(viewer, 'Ben')
  await viewer.goto(link)
  await viewer.getByRole('button', { name: `Join ${spaceName}` }).click()
  await viewer.waitForURL(/\/spaces\/|\/$/)
  await viewer.goto(`/?space=${spaceId}`)
  await rows(viewer).filter({ hasText: 'Dinner on Sunday' }).click()

  await expect(viewer.getByText(/· by Anna · View only/)).toBeVisible()
  await expect(viewer.getByRole('textbox', { name: 'Title' })).toHaveAttribute(
    'readonly',
    '',
  )
  await expect(viewer.getByRole('button', { name: /trash/ })).toBeHidden()

  // What another member adds while Ben looks on is announced to his screen reader.
  await capture(owner, 'Note', 'Bring dessert')
  await expect(
    viewer.getByRole('status').filter({ hasText: 'Anna added Bring dessert' }),
  ).toBeAttached()

  await owner.context().close()
  await viewer.context().close()
})
