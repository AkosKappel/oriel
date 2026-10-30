import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { listVersions as versionsOf } from '#/server/history'
import { signedIn } from '#/server/signed-in'

// History lives on the server only, so it needs a connection.

export const listVersions = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ itemId: z.uuid() }))
  .handler(async ({ data, context }) =>
    (await versionsOf(context.userId, data.itemId)).map(
      ({ savedAt, ...version }) => ({
        ...version,
        savedAt: savedAt.toISOString(),
      }),
    ),
  )
