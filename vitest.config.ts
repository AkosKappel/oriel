import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Server tests talk to the development database; CI passes DATABASE_URL directly.
if (existsSync('.env')) process.loadEnvFile()

// Separate from vite.config.ts so tests run without the Start, Nitro and devtools plugins.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
})
