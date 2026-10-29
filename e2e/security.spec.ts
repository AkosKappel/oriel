import { expect, test } from '@playwright/test'

// Server functions change data with the visitor's cookie, so another site must not be able to call
// them. The check runs before the function is looked up, so any server function path will do.
test('refuses server function calls from another site', async ({ request }) => {
  const call = (headers: Record<string, string>) =>
    request.post('/_serverFn/any-function', { headers, data: {} })

  expect((await call({ 'sec-fetch-site': 'cross-site' })).status()).toBe(403)
  expect((await call({ origin: 'https://evil.example' })).status()).toBe(403)
  expect((await call({ 'sec-fetch-site': 'same-origin' })).status()).not.toBe(
    403,
  )
})
