import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

// Needs the database (`docker compose up -d db` and `npm run db:migrate`).
describe.skipIf(!process.env.DATABASE_URL)('personal space', async () => {
  const { db } = await import('#/server/db')
  const { space, spaceMember, user } = await import('#/server/db/schema')
  const { ensurePersonalSpace } = await import('#/server/spaces')
  const { auth } = await import('#/server/auth')

  const created: string[] = []

  async function newUser() {
    const id = `test-${crypto.randomUUID()}`
    await db
      .insert(user)
      .values({ id, name: 'Test', email: `${id}@example.com` })
    created.push(id)
    return id
  }

  afterAll(async () => {
    // Spaces and memberships go with the users (on delete cascade).
    for (const id of created) await db.delete(user).where(eq(user.id, id))
  })

  it('creates one personal space with the user as owner, also when asked concurrently', async () => {
    const userId = await newUser()

    const ids = await Promise.all(
      Array.from({ length: 5 }, () => ensurePersonalSpace(userId)),
    )

    expect(new Set(ids).size).toBe(1)
    const members = await db
      .select()
      .from(spaceMember)
      .where(eq(spaceMember.spaceId, ids[0]))
    expect(members).toMatchObject([{ userId, role: 'owner' }])
  })

  it('returns the same space on later calls', async () => {
    const userId = await newUser()
    expect(await ensurePersonalSpace(userId)).toBe(
      await ensurePersonalSpace(userId),
    )
  })

  // Sign-up hashes the password with scrypt, slow on purpose; next to the other test files
  // running in parallel it can take longer than the default 5 seconds.
  it('gives every new account its personal space at sign-up', {
    timeout: 30_000,
  }, async () => {
    const email = `test-${crypto.randomUUID()}@example.com`
    const { user: signedUp } = await auth.api.signUpEmail({
      body: { name: 'New user', email, password: 'a-long-password' },
    })
    created.push(signedUp.id)

    const [personal] = await db
      .select()
      .from(space)
      .where(eq(space.personalOwnerId, signedUp.id))
    expect(personal?.name).toBe('Personal')
  })
})
