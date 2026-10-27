import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from '#/env'
import { db } from '#/server/db'
import * as schema from '#/server/db/schema'
import { releaseSpaces, SharingError } from '#/server/sharing'
import { ensurePersonalSpace } from '#/server/spaces'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // Email verification and password reset need an email provider (backlog B-02).
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  // Always on: Better Auth's default enables it only when NODE_ENV is `production`, which the
  // server does not set by itself. Per client IP from `X-Forwarded-For`, which the Tailscale
  // sidecar sets and overwrites; in memory, so limits reset on restart. Stricter than the default
  // for guessing passwords (3 per 10 seconds).
  rateLimit: {
    enabled: true,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 3600, max: 10 },
      '/delete-user': { window: 60, max: 5 },
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      // The personal space and memberships go with the user (on delete cascade).
      beforeDelete: async (user) => {
        try {
          await releaseSpaces(user.id)
        } catch (error) {
          if (error instanceof SharingError) {
            throw new APIError('BAD_REQUEST', { message: error.message })
          }
          throw error
        }
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // A failure here does not block sign-up: `getAccount` creates the space as well.
        after: async (user) => {
          await ensurePersonalSpace(user.id)
        },
      },
    },
  },
  // Must stay last: it sets the cookies of the responses above.
  plugins: [tanstackStartCookies()],
})
