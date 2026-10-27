import { createFileRoute } from '@tanstack/react-router'
import { env } from '#/env'
import { auth } from '#/server/auth'
import { loadSigningKey, signSyncToken } from '#/server/sync-token'

const signingKey = env.SYNC_JWT_PRIVATE_KEY
  ? loadSigningKey(env.SYNC_JWT_PRIVATE_KEY)
  : null

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
