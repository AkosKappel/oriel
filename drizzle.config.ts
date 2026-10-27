import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// CI passes the variables directly.
if (existsSync('.env')) process.loadEnvFile()

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
