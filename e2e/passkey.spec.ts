import { expect, test } from '@playwright/test'
import { expectNoAxeViolations, signUp } from './helpers'

// Chrome's virtual authenticator stands in for a phone's fingerprint or a security key: it
// answers every passkey request at once, as if the person had confirmed it.
test('adds a passkey, signs in with it and removes it', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    },
  )
  const presence = (enabled: boolean) =>
    cdp.send('WebAuthn.setAutomaticPresenceSimulation', {
      authenticatorId,
      enabled,
    })

  await signUp(page, 'Pat')
  await page.goto('/account')
  const passkeys = page.getByRole('region', { name: 'Passkeys' })
  await passkeys.getByRole('button', { name: 'Add a passkey' }).click()
  await expect(page.getByText('Passkey added.')).toBeVisible()
  await expect(passkeys.getByRole('listitem')).toHaveCount(1)

  // A signed-out browser that still holds the passkey. The page also offers it in the email
  // field's autofill, which the authenticator would answer by itself; the button is tested here.
  await page.context().clearCookies()
  await presence(false)
  await page.goto('/sign-in?mode=sign-in')
  const button = page.getByRole('button', { name: 'Sign in with a passkey' })
  await button.waitFor()
  await presence(true)
  await button.click()
  await page.waitForURL('/app')

  await page.goto('/account')
  await expect(passkeys.getByRole('listitem')).toHaveCount(1)
  await page.locator('[data-sonner-toast]').waitFor({ state: 'detached' })
  await expectNoAxeViolations(page)
  await passkeys.getByRole('button', { name: /^Remove the passkey/ }).click()
  await expect(page.getByText(/^Removed the passkey/)).toBeVisible()
  await expect(passkeys.getByRole('listitem')).toHaveCount(0)
})
