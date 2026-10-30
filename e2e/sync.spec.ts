import { expect, test } from '@playwright/test'
import { capture, rows, signIn, signUp } from './helpers'

test('keeps two devices of one account in sync, also after one was offline', async ({
  browser,
}) => {
  const phone = await (await browser.newContext()).newPage()
  const laptop = await (await browser.newContext()).newPage()

  const email = await signUp(phone, 'Ada')
  await capture(phone, 'List', 'Groceries: milk, eggs')
  await signIn(laptop, email)
  await expect(rows(laptop).filter({ hasText: 'Groceries' })).toContainText(
    '2 left',
  )

  // A change on one device arrives live on the other.
  await rows(laptop).filter({ hasText: 'Groceries' }).click()
  await laptop
    .getByRole('checkbox', { name: 'Check milk' })
    .check({ force: true })
  await expect(rows(phone).filter({ hasText: 'Groceries' })).toContainText(
    '1 left',
  )

  // Written offline, sent after reconnecting.
  await phone.context().setOffline(true)
  await capture(phone, 'Task', 'Written on the train')
  await phone.context().setOffline(false)
  await laptop.goto('/app')
  await expect(
    rows(laptop).filter({ hasText: 'Written on the train' }),
  ).toBeVisible()

  // A deletion reaches the other device too (through the trash).
  await rows(laptop).filter({ hasText: 'Written on the train' }).click()
  await laptop.getByRole('button', { name: 'Move task to the trash' }).click()
  await expect(
    rows(phone).filter({ hasText: 'Written on the train' }),
  ).toHaveCount(0)

  await phone.context().close()
  await laptop.context().close()
})
