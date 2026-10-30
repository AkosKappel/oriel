import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

// Needs the database (`docker compose up -d db` and `npm run db:migrate`).
describe.skipIf(!process.env.DATABASE_URL)('password reset', async () => {
  const { db } = await import('#/server/db')
  const { passkey, user } = await import('#/server/db/schema')
  const { auth } = await import('#/server/auth')

  const created: string[] = []

  afterAll(async () => {
    // Passkeys go with the users (on delete cascade).
    for (const id of created) await db.delete(user).where(eq(user.id, id))
  })

  it("removes the user's passkeys, and only theirs", async () => {
    const users = await Promise.all(
      ['reset', 'other'].map(async (name) => {
        const { user: account } = await auth.api.signUpEmail({
          body: {
            name,
            email: `test-${crypto.randomUUID()}@example.com`,
            password: 'a long enough password',
          },
        })
        created.push(account.id)
        await db.insert(passkey).values({
          id: crypto.randomUUID(),
          userId: account.id,
          publicKey: 'key',
          credentialID: crypto.randomUUID(),
          counter: 0,
          deviceType: 'singleDevice',
          backedUp: false,
        })
        return account.id
      }),
    )
    // The token the reset email would carry, stored the way Better Auth stores it.
    const token = crypto.randomUUID()
    const context = await auth.$context
    await context.internalAdapter.createVerificationValue({
      identifier: `reset-password:${token}`,
      value: users[0],
      expiresAt: new Date(Date.now() + 60_000),
    })

    await auth.api.resetPassword({
      body: { token, newPassword: 'another long password' },
    })

    const left = await db.select().from(passkey)
    expect(left.filter((row) => row.userId === users[0])).toEqual([])
    expect(left.filter((row) => row.userId === users[1])).toHaveLength(1)
  })
})
