import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/server/auth'
import { applyUpload, uploadSchema } from '#/server/upload'

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
