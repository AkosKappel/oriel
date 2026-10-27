import { createFileRoute } from '@tanstack/react-router'
import { env } from '#/env'
import { auth } from '#/server/auth'
import { createRateLimit, tooManyRequests } from '#/server/rate-limit'
import { loadSigningKey, signSyncToken } from '#/server/sync-token'

const signingKey = env.SYNC_JWT_PRIVATE_KEY
  ? loadSigningKey(env.SYNC_JWT_PRIVATE_KEY)
  : null

// Tokens last 15 minutes; a device asks again on reconnect, far below this.
const tokenLimit = createRateLimit({ windowMs: 60_000, max: 30 })

/** PowerSync credentials for the signed-in user: the service address and a short-lived token. */
export const Route = createFileRoute('/api/sync/token')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!signingKey || !env.PS_JWT_KID || !env.POWERSYNC_URL) {
          return Response.json(
            { error: 'Sync is not configured on this server' },
            { status: 503 },
          )
        }
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return Response.json({ error: 'Not signed in' }, { status: 401 })
        }
        const limit = tokenLimit(session.user.id)
        if (!limit.allowed) return tooManyRequests(limit.retryAfter)
        return Response.json(
          {
            endpoint: env.POWERSYNC_URL,
            token: signSyncToken({
              userId: session.user.id,
              key: signingKey,
              kid: env.PS_JWT_KID,
            }),
          },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      },
    },
  },
})
