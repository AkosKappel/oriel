import { expect, test } from '@playwright/test'
import { capture, rows } from './helpers'

test('opens and saves offline once the app has been loaded', async ({
  page,
  context,
}) => {
  await page.goto('/app')
  await capture(page, 'Note', 'Written online')
  // The service worker precaches the app on the first visit.
  await page.evaluate(() => navigator.serviceWorker.ready)

  await context.setOffline(true)
  await page.reload()
  await expect(
    page.getByText(/Offline\. Changes are saved on this device\./),
  ).toBeVisible()
  await expect(rows(page)).toContainText(['Written online'])

  await capture(page, 'Task', 'Written offline')
  await page.reload()
  await expect(rows(page)).toHaveCount(2)

  await context.setOffline(false)
  await expect(page.getByText(/Offline\./)).toHaveCount(0)
})
