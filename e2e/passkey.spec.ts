import { expect, test } from '@playwright/test'
import { expectNoAxeViolations, signUp } from './helpers'

// Chrome's virtual authenticator stands in for a phone's fingerprint or a security key: it
// answers every passkey request at once, as if the person had confirmed it.
test('adds a passkey, signs in with it and removes it', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  })

  await signUp(page, 'Pat')
  await page.goto('/account')
  const passkeys = page.getByRole('region', { name: 'Passkeys' })
  await passkeys.getByRole('button', { name: 'Add a passkey' }).click()
  await expect(page.getByText('Passkey added.')).toBeVisible()
  await expect(passkeys.getByRole('listitem')).toHaveCount(1)

  // A signed-out browser that still holds the passkey.
  await page.context().clearCookies()
  await page.goto('/sign-in?mode=sign-in')
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await page.waitForURL('/app')

  await page.goto('/account')
  await expect(passkeys.getByRole('listitem')).toHaveCount(1)
  await page.locator('[data-sonner-toast]').waitFor({ state: 'detached' })
  await expectNoAxeViolations(page)
  await passkeys.getByRole('button', { name: /^Remove the passkey/ }).click()
  await expect(page.getByText(/^Removed the passkey/)).toBeVisible()
  await expect(passkeys.getByRole('listitem')).toHaveCount(0)
})
