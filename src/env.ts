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
  // Optional: without it, emails are printed to the server output (development and CI).
  RESEND_API_KEY: z.preprocess(
    (value) => value || undefined,
    z.string().optional(),
  ),
  // Must be on a domain verified in Resend; onboarding@resend.dev only reaches the account owner.
  EMAIL_FROM: z.string().default('Oriel <onboarding@resend.dev>'),
  // Optional: morning reminders (Web Push) are offered only with a VAPID key pair, made once with
  // `npx web-push generate-vapid-keys`. The subject is a contact for the push services.
  VAPID_PUBLIC_KEY: z.preprocess(
    (value) => value || undefined,
    z.string().optional(),
  ),
  VAPID_PRIVATE_KEY: z.preprocess(
    (value) => value || undefined,
    z.string().optional(),
  ),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  throw new Error(
    `Invalid environment, see .env.example:\n${z.prettifyError(result.error)}`,
  )
}

export const env = result.data
