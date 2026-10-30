import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
import { env } from '#/env'
import { db } from '#/server/db'
import * as schema from '#/server/db/schema'
import { spaceMember } from '#/server/db/schema'
import { sendPasswordResetEmail } from '#/server/email'
import { releaseSpaces, SharingError } from '#/server/sharing'
import { ensurePersonalSpace } from '#/server/spaces'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // Email verification needs a verified sender domain first (backlog B-02).
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, url })
    },
    // Whoever knew the old password is signed out everywhere.
    revokeSessionsOnPasswordReset: true,
  },
  // Always on: Better Auth's default enables it only when NODE_ENV is `production`, which the
  // server does not set by itself. Per client IP from `X-Forwarded-For`, which the Tailscale
  // sidecar sets and overwrites; in memory, so limits reset on restart. Stricter than the default
  // for guessing passwords (3 per 10 seconds).
  rateLimit: {
    enabled: true,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/passkey/verify-authentication': { window: 60, max: 10 },
      '/sign-up/email': { window: 3600, max: 10 },
      '/request-password-reset': { window: 3600, max: 5 },
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
      update: {
        // Memberships carry a copy of the name (the user table never syncs), so a new name has
        // to reach every space the user is in.
        after: async (user) => {
          await db
            .update(spaceMember)
            .set({ memberName: user.name })
            .where(eq(spaceMember.userId, user.id))
        },
      },
    },
  },
  plugins: [
    // A passkey belongs to the host name, so one made on localhost never works in production.
    // Adding one needs a session from the last day (Better Auth's `freshAge`).
    passkey({
      rpID: new URL(env.BETTER_AUTH_URL).hostname,
      rpName: 'Oriel',
      origin: new URL(env.BETTER_AUTH_URL).origin,
    }),
    // Must stay last: it sets the cookies of the responses above.
    tanstackStartCookies(),
  ],
})
