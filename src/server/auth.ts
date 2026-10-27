import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from '#/env'
import { db } from '#/server/db'
import * as schema from '#/server/db/schema'
import { ensurePersonalSpace } from '#/server/spaces'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // Email verification and password reset need an email provider (backlog B-02).
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
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
