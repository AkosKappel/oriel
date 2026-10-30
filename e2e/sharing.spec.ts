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

  await owner.goto(`/app?space=${spaceId}`)
  await capture(owner, 'Note', 'Dinner on Sunday')

  await signUp(viewer, 'Ben')
  await viewer.goto(link)
  await viewer.getByRole('button', { name: `Join ${spaceName}` }).click()
  await viewer.waitForURL(/\/spaces\/|\/app$/)
  await viewer.goto(`/app?space=${spaceId}`)
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

  // The space page lists who changed what, linking to the item.
  await viewer.goto(`/spaces/${spaceId}`)
  const changes = viewer.getByRole('region', { name: 'Recent changes' })
  await expect(changes.getByRole('listitem').first()).toContainText(
    'Anna added Bring dessert',
  )
  await expectNoAxeViolations(viewer)
  await changes.getByRole('link', { name: 'Dinner on Sunday' }).click()
  await expect(viewer.getByRole('textbox', { name: 'Title' })).toHaveValue(
    'Dinner on Sunday',
  )

  // A task the owner gives to Ben shows under his "For me".
  await capture(owner, 'Task', 'Buy wine')
  await rows(owner).filter({ hasText: 'Buy wine' }).click()
  await owner.getByRole('radio', { name: 'Ben' }).check({ force: true })
  await viewer.goto('/app?type=task')
  await viewer.getByRole('link', { name: 'For me' }).click()
  await expect(rows(viewer)).toHaveCount(1)
  await expect(rows(viewer).first()).toContainText('For you')
  await expect(rows(viewer).first()).toContainText('Buy wine')

  await owner.context().close()
  await viewer.context().close()
})
