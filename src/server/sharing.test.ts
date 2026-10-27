import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

// Needs the database (`docker compose up -d db` and `npm run db:migrate`).
describe.skipIf(!process.env.DATABASE_URL)('sharing', async () => {
  const { db } = await import('#/server/db')
  const { invite, space, spaceMember, user } = await import(
    '#/server/db/schema'
  )
  const { ensurePersonalSpace } = await import('#/server/spaces')
  const sharing = await import('#/server/sharing')

  const users: string[] = []

  async function newUser(name: string) {
    const id = `test-${crypto.randomUUID()}`
    await db.insert(user).values({ id, name, email: `${id}@example.com` })
    users.push(id)
    return id
  }

  afterAll(async () => {
    // Shared spaces have no owner column, so they do not go with their users.
    for (const id of shared) await db.delete(space).where(eq(space.id, id))
    for (const id of users) await db.delete(user).where(eq(user.id, id))
  })

  const shared: string[] = []
  async function newSpace(ownerId: string, name: string) {
    const id = await sharing.createSharedSpace(ownerId, name)
    shared.push(id)
    return id
  }

  const roleOf = async (spaceId: string, userId: string) =>
    (
      await db
        .select({ role: spaceMember.role, name: spaceMember.memberName })
        .from(spaceMember)
        .where(
          and(eq(spaceMember.spaceId, spaceId), eq(spaceMember.userId, userId)),
        )
    )[0]

  it('makes the creator the owner, with their name on the membership', async () => {
    const anna = await newUser('Anna')
    const family = await newSpace(anna, '  Family ')

    expect(await roleOf(family, anna)).toEqual({ role: 'owner', name: 'Anna' })
    const [created] = await db.select().from(space).where(eq(space.id, family))
    expect(created).toMatchObject({ name: 'Family', personalOwnerId: null })
  })

  it('lets someone join once with an invite link, in the role it was made for', async () => {
    const anna = await newUser('Anna')
    const ben = await newUser('Ben')
    const cleo = await newUser('Cleo')
    const family = await newSpace(anna, 'Family')
    const token = await sharing.createInvite(anna, family, 'viewer')

    expect(await sharing.describeInvite(token)).toEqual({
      spaceName: 'Family',
      inviterName: 'Anna',
      role: 'viewer',
      state: 'open',
    })
    expect(await sharing.acceptInvite(ben, token)).toBe(family)
    expect(await roleOf(family, ben)).toEqual({ role: 'viewer', name: 'Ben' })
    // Opening it again as a member is harmless; anyone else is refused.
    expect(await sharing.acceptInvite(ben, token)).toBe(family)
    await expect(sharing.acceptInvite(cleo, token)).rejects.toThrow(
      'already been used',
    )
    expect((await sharing.describeInvite(token))?.state).toBe('used')
  })

  it('stores only a hash of the token and refuses unknown or expired links', async () => {
    const anna = await newUser('Anna')
    const ben = await newUser('Ben')
    const family = await newSpace(anna, 'Family')
    const token = await sharing.createInvite(anna, family, 'editor')

    const stored = await db
      .select()
      .from(invite)
      .where(eq(invite.spaceId, family))
    expect(stored[0].tokenHash).not.toContain(token)
    expect(await sharing.describeInvite('made-up')).toBeNull()

    await db
      .update(invite)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invite.spaceId, family))
    await expect(sharing.acceptInvite(ben, token)).rejects.toThrow('expired')
    expect(await roleOf(family, ben)).toBeUndefined()
  })

  it('records who an emailed invite is for, and caps emailed invites per day', async () => {
    const anna = await newUser('Anna')
    const family = await newSpace(anna, 'Family')

    await sharing.createInvite(anna, family, 'editor', 'ben@example.com')
    expect(await sharing.listInvites(anna, family)).toMatchObject([
      { role: 'editor', email: 'ben@example.com' },
    ])

    await expect(
      sharing.createInvite(anna, family, 'editor', 'not an address'),
    ).rejects.toThrow()
    for (let sent = 1; sent < 20; sent++) {
      await sharing.createInvite(anna, family, 'viewer', `${sent}@example.com`)
    }
    await expect(
      sharing.createInvite(anna, family, 'viewer', 'one@too-many.com'),
    ).rejects.toThrow('a lot of invites')
    // Links without an email are not limited.
    await sharing.createInvite(anna, family, 'viewer')
  })

  it('lets only owners invite, rename, change roles and remove others', async () => {
    const anna = await newUser('Anna')
    const ben = await newUser('Ben')
    const family = await newSpace(anna, 'Family')
    await sharing.acceptInvite(
      ben,
      await sharing.createInvite(anna, family, 'editor'),
    )

    const ownerOnly = 'Only an owner'
    await expect(sharing.createInvite(ben, family, 'viewer')).rejects.toThrow(
      ownerOnly,
    )
    await expect(sharing.renameSpace(ben, family, 'Mine')).rejects.toThrow(
      ownerOnly,
    )
    await expect(
      sharing.setMemberRole(ben, family, ben, 'owner'),
    ).rejects.toThrow(ownerOnly)
    await expect(sharing.removeMember(ben, family, anna)).rejects.toThrow(
      ownerOnly,
    )
    await expect(sharing.deleteSpace(ben, family)).rejects.toThrow(ownerOnly)
  })

  it('always keeps an owner, and lets members leave', async () => {
    const anna = await newUser('Anna')
    const ben = await newUser('Ben')
    const family = await newSpace(anna, 'Family')
    await sharing.acceptInvite(
      ben,
      await sharing.createInvite(anna, family, 'editor'),
    )

    await expect(
      sharing.setMemberRole(anna, family, anna, 'editor'),
    ).rejects.toThrow('needs an owner')
    await expect(sharing.removeMember(anna, family, anna)).rejects.toThrow(
      'needs an owner',
    )

    await sharing.setMemberRole(anna, family, ben, 'owner')
    await sharing.removeMember(anna, family, anna)
    expect(await roleOf(family, anna)).toBeUndefined()
    expect((await roleOf(family, ben))?.role).toBe('owner')
  })

  it('before an account is deleted, removes spaces nobody else uses and keeps an owner on the rest', async () => {
    const anna = await newUser('Anna')
    const ben = await newUser('Ben')
    const solo = await newSpace(anna, 'Just me')
    const family = await newSpace(anna, 'Family')
    await sharing.acceptInvite(
      ben,
      await sharing.createInvite(anna, family, 'editor'),
    )
    const exists = async (id: string) =>
      (await db.select().from(space).where(eq(space.id, id))).length === 1

    await expect(sharing.releaseSpaces(anna)).rejects.toThrow(
      'Family needs another owner first',
    )
    expect(await exists(solo)).toBe(true)

    await sharing.setMemberRole(anna, family, ben, 'owner')
    await sharing.releaseSpaces(anna)
    expect(await exists(solo)).toBe(false)
    expect(await exists(family)).toBe(true)
  })

  it('keeps personal spaces private', async () => {
    const anna = await newUser('Anna')
    const personal = await ensurePersonalSpace(anna)

    expect(await roleOf(personal, anna)).toEqual({
      role: 'owner',
      name: 'Anna',
    })
    await expect(
      sharing.createInvite(anna, personal, 'editor'),
    ).rejects.toThrow('stays private')
    await expect(sharing.deleteSpace(anna, personal)).rejects.toThrow(
      'cannot be deleted',
    )
    await expect(sharing.removeMember(anna, personal, anna)).rejects.toThrow(
      'personal space',
    )
  })

  it('deletes a shared space for everyone, and lets owners revoke open invites', async () => {
    const anna = await newUser('Anna')
    const family = await newSpace(anna, 'Family')
    const token = await sharing.createInvite(anna, family, 'viewer')
    const [open] = await sharing.listInvites(anna, family)

    await sharing.revokeInvite(anna, open.id)
    expect(await sharing.listInvites(anna, family)).toEqual([])
    expect(await sharing.describeInvite(token)).toBeNull()

    await sharing.deleteSpace(anna, family)
    expect(await db.select().from(space).where(eq(space.id, family))).toEqual(
      [],
    )
  })
})
