import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/server/auth'
import { createRateLimit, tooManyRequests } from '#/server/rate-limit'
import { applyUpload, uploadSchema } from '#/server/upload'

// Batches hold up to 200 changes, so this still clears a long offline queue within minutes.
const uploadLimit = createRateLimit({ windowMs: 60_000, max: 60 })

/**
 * Receives the device's PowerSync upload queue. Answers 200 with the rejected operations (the
 * device drops them); 401 and 5xx make the device keep the batch and retry later.
 */
export const Route = createFileRoute('/api/sync/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return Response.json({ error: 'Not signed in' }, { status: 401 })
        }
        const limit = uploadLimit(session.user.id)
        if (!limit.allowed) return tooManyRequests(limit.retryAfter)
        const body = uploadSchema.safeParse(
          await request.json().catch(() => null),
        )
        if (!body.success) {
          return Response.json({ error: 'Malformed batch' }, { status: 400 })
        }
        const result = await applyUpload(session.user.id, body.data.operations)
        if (result.rejected.length > 0) {
          console.warn('Rejected uploads', {
            userId: session.user.id,
            rejected: result.rejected,
          })
        }
        return Response.json(result)
      },
    },
  },
})
