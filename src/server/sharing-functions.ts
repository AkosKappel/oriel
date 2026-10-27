import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/server/auth'
import * as sharing from '#/server/sharing'

// Sharing actions need a connection; content inside a shared space still works offline through
// the upload queue. Errors carry messages meant for the user.

const signedIn = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) throw new Error('Sign in to share spaces.')
    return next({ context: { userId: session.user.id } })
  },
)

const spaceInput = z.object({ spaceId: z.uuid() })

export const createSpace = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ name: sharing.spaceNameSchema }))
  .handler(({ data, context }) =>
    sharing.createSharedSpace(context.userId, data.name),
  )

export const renameSpace = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(spaceInput.extend({ name: sharing.spaceNameSchema }))
  .handler(({ data, context }) =>
    sharing.renameSpace(context.userId, data.spaceId, data.name),
  )

export const deleteSpace = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(spaceInput)
  .handler(({ data, context }) =>
    sharing.deleteSpace(context.userId, data.spaceId),
  )

export const createInvite = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(spaceInput.extend({ role: sharing.inviteRoleSchema }))
  .handler(({ data, context }) =>
    sharing.createInvite(context.userId, data.spaceId, data.role),
  )

export const listInvites = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(spaceInput)
  .handler(async ({ data, context }) =>
    (await sharing.listInvites(context.userId, data.spaceId)).map(
      ({ id, role, expiresAt }) => ({
        id,
        role,
        expiresAt: expiresAt.toISOString(),
      }),
    ),
  )

export const revokeInvite = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ inviteId: z.uuid() }))
  .handler(({ data, context }) =>
    sharing.revokeInvite(context.userId, data.inviteId),
  )

/** Public: the invite page shows this before the visitor has an account. */
export const describeInvite = createServerFn({ method: 'GET' })
  .validator(z.object({ token: z.string().min(1).max(100) }))
  .handler(({ data }) => sharing.describeInvite(data.token))

export const acceptInvite = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ token: z.string().min(1).max(100) }))
  .handler(({ data, context }) =>
    sharing.acceptInvite(context.userId, data.token),
  )

export const setMemberRole = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(
    spaceInput.extend({
      memberId: z.string().min(1),
      role: z.enum(['owner', 'editor', 'viewer']),
    }),
  )
  .handler(({ data, context }) =>
    sharing.setMemberRole(
      context.userId,
      data.spaceId,
      data.memberId,
      data.role,
    ),
  )

export const removeMember = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(spaceInput.extend({ memberId: z.string().min(1) }))
  .handler(({ data, context }) =>
    sharing.removeMember(context.userId, data.spaceId, data.memberId),
  )
