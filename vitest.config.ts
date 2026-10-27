import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so tests run without the Start, Nitro and devtools plugins.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
})
