import { defineConfig, devices } from '@playwright/test'

const port = 3100

// End-to-end tests run against the production build (`npm run build` first), a migrated
// database and the PowerSync Service (see README, Getting started). Every test signs up its own
// accounts; the teardown deletes them.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // One worker locally: the development machine also runs live apps.
  workers: process.env.CI ? 2 : 1,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalTeardown: './e2e/teardown.ts',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node --env-file-if-exists=.env .output/server/index.mjs',
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    // An empty key keeps test invites from sending real emails.
    env: {
      PORT: String(port),
      BETTER_AUTH_URL: `http://localhost:${port}`,
      RESEND_API_KEY: '',
    },
  },
})
