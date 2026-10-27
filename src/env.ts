import { z } from 'zod'

// Server-only. Checked when the server first needs it (not at build time), so a missing or
// weak setting fails with a message naming it.
const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'Use at least 32 characters, e.g. `openssl rand -base64 32`.'),
  BETTER_AUTH_URL: z.url(),
  // Optional: without these the app works on the device only and sync stays off.
  // Generate with `node scripts/generate-sync-keys.mjs >> .env`.
  SYNC_JWT_PRIVATE_KEY: z.preprocess(
    (value) => value || undefined,
    z.base64().optional(),
  ),
  PS_JWT_KID: z.preprocess(
    (value) => value || undefined,
    z.string().optional(),
  ),
  POWERSYNC_URL: z.preprocess(
    (value) => value || undefined,
    z.url().optional(),
  ),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  throw new Error(
    `Invalid environment, see .env.example:\n${z.prettifyError(result.error)}`,
  )
}

export const env = result.data
