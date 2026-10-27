import { createHash, randomBytes } from 'node:crypto'
import { and, count, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/server/db'
import { invite, space, spaceMember, user } from '#/server/db/schema'

// Sharing rules. Everything here runs on the server with the signed-in user as `actorId`; the
// server functions in sharing-functions.ts are thin wrappers. Who may do what:
//   owner   rename or delete the space, invite, change roles, remove members
//   editor  change content (enforced by the upload endpoint)
//   viewer  read only
// A personal space is never shared, and a space always keeps at least one owner.

export const spaceNameSchema = z.string().trim().min(1, 'Add a name').max(60)
export const inviteRoleSchema = z.enum(['editor', 'viewer'])
export const inviteEmailSchema = z.email('Check the email address').max(254)
export type MemberRole = 'owner' | 'editor' | 'viewer'

const inviteLifetimeDays = 7
// Accounts are not email-verified, so emailed invites are capped to keep Oriel from being a spam relay.
const emailedInvitesPerDay = 20

/** A refusal the user should read, as opposed to a failure. */
export class SharingError extends Error {}

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function roleOf(tx: Tx, spaceId: string, userId: string) {
  const [membership] = await tx
    .select({ role: spaceMember.role })
    .from(spaceMember)
    .where(
      and(eq(spaceMember.spaceId, spaceId), eq(spaceMember.userId, userId)),
    )
  return membership?.role ?? null
}

async function requireOwner(tx: Tx, spaceId: string, actorId: string) {
  if ((await roleOf(tx, spaceId, actorId)) !== 'owner') {
    throw new SharingError('Only an owner of this space can do that.')
  }
}

async function nameOf(tx: Tx, userId: string) {
  const [found] = await tx
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
  return found.name
}

async function ownerCount(tx: Tx, spaceId: string) {
  const [{ owners }] = await tx
    .select({ owners: count() })
    .from(spaceMember)
    .where(and(eq(spaceMember.spaceId, spaceId), eq(spaceMember.role, 'owner')))
  return owners
}

export async function createSharedSpace(actorId: string, name: string) {
  const parsed = spaceNameSchema.parse(name)
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(space)
      .values({ name: parsed })
      .returning({ id: space.id })
    await tx.insert(spaceMember).values({
      spaceId: created.id,
      userId: actorId,
      role: 'owner',
      memberName: await nameOf(tx, actorId),
    })
    return created.id
  })
}

export async function renameSpace(
  actorId: string,
  spaceId: string,
  name: string,
) {
  const parsed = spaceNameSchema.parse(name)
  await db.transaction(async (tx) => {
    await requireOwner(tx, spaceId, actorId)
    await tx.update(space).set({ name: parsed }).where(eq(space.id, spaceId))
  })
}

/** Deletes a shared space with everything in it, for every member. */
export async function deleteSpace(actorId: string, spaceId: string) {
  await db.transaction(async (tx) => {
    await requireOwner(tx, spaceId, actorId)
    const [found] = await tx
      .select({ personalOwnerId: space.personalOwnerId })
      .from(space)
      .where(eq(space.id, spaceId))
    if (found.personalOwnerId) {
      throw new SharingError('Your personal space cannot be deleted.')
    }
    await tx.delete(space).where(eq(space.id, spaceId))
  })
}

/**
 * Returns the secret token for the link; only its hash is stored. With an email, the invite is
 * recorded for that address (the caller sends the email).
 */
export async function createInvite(
  actorId: string,
  spaceId: string,
  role: z.infer<typeof inviteRoleSchema>,
  email?: string,
) {
  const parsedRole = inviteRoleSchema.parse(role)
  const parsedEmail =
    email === undefined ? null : inviteEmailSchema.parse(email)
  return db.transaction(async (tx) => {
    await requireOwner(tx, spaceId, actorId)
    if (parsedEmail) {
      const [{ sent }] = await tx
        .select({ sent: count() })
        .from(invite)
        .where(
          and(
            eq(invite.createdBy, actorId),
            isNotNull(invite.email),
            gt(invite.createdAt, new Date(Date.now() - 86_400_000)),
          ),
        )
      if (sent >= emailedInvitesPerDay) {
        throw new SharingError(
          'That is a lot of invites for one day. Share the link instead, or try again tomorrow.',
        )
      }
    }
    const [found] = await tx
      .select({ personalOwnerId: space.personalOwnerId })
      .from(space)
      .where(eq(space.id, spaceId))
    if (found.personalOwnerId) {
      throw new SharingError(
        'Your personal space stays private. Share a separate space instead.',
      )
    }
    const token = randomBytes(32).toString('base64url')
    await tx.insert(invite).values({
      spaceId,
      tokenHash: hashToken(token),
      role: parsedRole,
      email: parsedEmail,
      createdBy: actorId,
      expiresAt: new Date(Date.now() + inviteLifetimeDays * 86_400_000),
    })
    return token
  })
}

/** Open invites of a space (not used, not expired), for its owners. */
export async function listInvites(actorId: string, spaceId: string) {
  return db.transaction(async (tx) => {
    await requireOwner(tx, spaceId, actorId)
    return tx
      .select({
        id: invite.id,
        role: invite.role,
        email: invite.email,
        expiresAt: invite.expiresAt,
      })
      .from(invite)
      .where(
        and(
          eq(invite.spaceId, spaceId),
          isNull(invite.acceptedBy),
          gt(invite.expiresAt, new Date()),
        ),
      )
      .orderBy(invite.createdAt)
  })
}

export async function revokeInvite(actorId: string, inviteId: string) {
  await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ spaceId: invite.spaceId })
      .from(invite)
      .where(eq(invite.id, inviteId))
    if (!found) return
    await requireOwner(tx, found.spaceId, actorId)
    await tx.delete(invite).where(eq(invite.id, inviteId))
  })
}

async function findInvite(tx: Tx | typeof db, token: string) {
  const [found] = await tx
    .select({
      id: invite.id,
      spaceId: invite.spaceId,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedBy: invite.acceptedBy,
      spaceName: space.name,
      inviterName: user.name,
    })
    .from(invite)
    .innerJoin(space, eq(space.id, invite.spaceId))
    .innerJoin(user, eq(user.id, invite.createdBy))
    .where(eq(invite.tokenHash, hashToken(token)))
  return found
}

/** What the invite page shows before anyone signs in: only the space and who invited. */
export async function describeInvite(token: string) {
  const found = await findInvite(db, token)
  if (!found) return null
  return {
    spaceName: found.spaceName,
    inviterName: found.inviterName,
    role: found.role,
    state: found.acceptedBy
      ? ('used' as const)
      : found.expiresAt <= new Date()
        ? ('expired' as const)
        : ('open' as const),
  }
}

/** Joins the space of the invite. Single use; joining again as a member changes nothing. */
export async function acceptInvite(actorId: string, token: string) {
  return db.transaction(async (tx) => {
    const found = await findInvite(tx, token)
    if (!found) throw new SharingError('This invite link is not valid.')
    if (await roleOf(tx, found.spaceId, actorId)) return found.spaceId
    if (found.acceptedBy) {
      throw new SharingError('This invite link has already been used.')
    }
    if (found.expiresAt <= new Date()) {
      throw new SharingError('This invite link has expired. Ask for a new one.')
    }
    // Claimed with a condition, so two people opening the same link cannot both join.
    const [claimed] = await tx
      .update(invite)
      .set({ acceptedBy: actorId, acceptedAt: new Date() })
      .where(and(eq(invite.id, found.id), isNull(invite.acceptedBy)))
      .returning({ id: invite.id })
    if (!claimed) {
      throw new SharingError('This invite link has already been used.')
    }
    await tx.insert(spaceMember).values({
      spaceId: found.spaceId,
      userId: actorId,
      role: found.role,
      memberName: await nameOf(tx, actorId),
    })
    return found.spaceId
  })
}

export async function setMemberRole(
  actorId: string,
  spaceId: string,
  memberId: string,
  role: MemberRole,
) {
  const parsedRole = z.enum(['owner', 'editor', 'viewer']).parse(role)
  await db.transaction(async (tx) => {
    await requireOwner(tx, spaceId, actorId)
    const current = await roleOf(tx, spaceId, memberId)
    if (!current) throw new SharingError('That person is not a member.')
    if (
      current === 'owner' &&
      parsedRole !== 'owner' &&
      (await ownerCount(tx, spaceId)) === 1
    ) {
      throw new SharingError(
        'A space needs an owner. Make someone else owner first.',
      )
    }
    await tx
      .update(spaceMember)
      .set({ role: parsedRole })
      .where(
        and(eq(spaceMember.spaceId, spaceId), eq(spaceMember.userId, memberId)),
      )
  })
}

/** An owner removes someone, or anyone leaves (memberId = actorId). */
export async function removeMember(
  actorId: string,
  spaceId: string,
  memberId: string,
) {
  await db.transaction(async (tx) => {
    if (memberId !== actorId) await requireOwner(tx, spaceId, actorId)
    const [found] = await tx
      .select({ personalOwnerId: space.personalOwnerId })
      .from(space)
      .where(eq(space.id, spaceId))
    if (!found || found.personalOwnerId) {
      throw new SharingError('Nobody can leave a personal space.')
    }
    const current = await roleOf(tx, spaceId, memberId)
    if (!current) return
    if (current === 'owner' && (await ownerCount(tx, spaceId)) === 1) {
      throw new SharingError(
        'A space needs an owner. Make someone else owner first, or delete the space.',
      )
    }
    await tx
      .delete(spaceMember)
      .where(
        and(eq(spaceMember.spaceId, spaceId), eq(spaceMember.userId, memberId)),
      )
  })
}

/**
 * Runs before an account is deleted. Shared spaces have no owner column, so the user cascade does
 * not remove them: spaces where the user is the only member are deleted here. A space the user
 * is the only owner of while others still use it is not handed over silently; the deletion is
 * refused until someone else is made owner (the same rule as leaving).
 */
export async function releaseSpaces(userId: string) {
  await db.transaction(async (tx) => {
    const memberships = await tx
      .select({
        spaceId: spaceMember.spaceId,
        role: spaceMember.role,
        name: space.name,
      })
      .from(spaceMember)
      .innerJoin(space, eq(space.id, spaceMember.spaceId))
      .where(and(eq(spaceMember.userId, userId), isNull(space.personalOwnerId)))

    const alone: string[] = []
    const needOwner: string[] = []
    for (const membership of memberships) {
      const [{ members }] = await tx
        .select({ members: count() })
        .from(spaceMember)
        .where(eq(spaceMember.spaceId, membership.spaceId))
      if (members === 1) alone.push(membership.spaceId)
      else if (
        membership.role === 'owner' &&
        (await ownerCount(tx, membership.spaceId)) === 1
      ) {
        needOwner.push(membership.name)
      }
    }

    if (needOwner.length > 0) {
      throw new SharingError(
        `${needOwner.join(', ')} ${needOwner.length === 1 ? 'needs' : 'need'} another owner first. Make someone owner in Spaces, or delete the space.`,
      )
    }
    if (alone.length > 0) await tx.delete(space).where(inArray(space.id, alone))
  })
}
