import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { env } from '#/env'
import { sendInviteEmail } from '#/server/email'
import * as sharing from '#/server/sharing'
import { signedIn } from '#/server/signed-in'

// Sharing actions need a connection; content inside a shared space still works offline through
// the upload queue. Errors carry messages meant for the user.

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
  .validator(
    spaceInput.extend({
      role: sharing.inviteRoleSchema,
      email: sharing.inviteEmailSchema.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const token = await sharing.createInvite(
      context.userId,
      data.spaceId,
      data.role,
      data.email,
    )
    const invite = await sharing.describeInvite(token)
    const emailed =
      data.email && invite
        ? await sendInviteEmail({
            to: data.email,
            inviterName: context.name,
            inviterEmail: context.email,
            spaceName: invite.spaceName,
            url: new URL(`/invite/${token}`, env.BETTER_AUTH_URL).href,
          })
        : false
    return { token, emailed }
  })

export const listInvites = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(spaceInput)
  .handler(async ({ data, context }) =>
    (await sharing.listInvites(context.userId, data.spaceId)).map(
      ({ id, role, email, expiresAt }) => ({
        id,
        role,
        email,
        expiresAt: expiresAt.toISOString(),
      }),
    ),
  )

export const listActivity = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(spaceInput)
  .handler(async ({ data, context }) =>
    (await sharing.listActivity(context.userId, data.spaceId)).map(
      ({ at, ...line }) => ({ ...line, at: at.toISOString() }),
    ),
  )

export const revokeInvite = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ inviteId: z.uuid() }))
  .handler(({ data, context }) =>
    sharing.revokeInvite(context.userId, data.inviteId),
  )

/**
 * Public: the invite page shows this before the visitor has an account. POST, because a GET server
 * function carries its input, the invite token, in the URL, which the access log records.
 */
export const describeInvite = createServerFn({ method: 'POST' })
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
