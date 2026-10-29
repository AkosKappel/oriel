import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

// Needs the database (`docker compose up -d db` and `npm run db:migrate`).
describe.skipIf(!process.env.DATABASE_URL)('signed-in devices', async () => {
  const { db } = await import('#/server/db')
  const { session, user } = await import('#/server/db/schema')
  const { listDevices, signOutDevice } = await import('#/server/sessions')

  const created: string[] = []
  const day = 24 * 60 * 60 * 1000

  async function newUser() {
    const id = `test-${crypto.randomUUID()}`
    await db
      .insert(user)
      .values({ id, name: 'Test', email: `${id}@example.com` })
    created.push(id)
    return id
  }

  async function newSession(
    userId: string,
    userAgent: string | null,
    expiresIn = day,
  ) {
    const id = crypto.randomUUID()
    await db.insert(session).values({
      id,
      userId,
      userAgent,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + expiresIn),
    })
    return id
  }

  afterAll(async () => {
    // Sessions go with the users (on delete cascade).
    for (const id of created) await db.delete(user).where(eq(user.id, id))
  })

  it('lists active sessions, marks the current one and leaves out expired ones', async () => {
    const userId = await newUser()
    const phone = await newSession(
      userId,
      'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36',
    )
    const laptop = await newSession(userId, null)
    await newSession(userId, null, -day)
    await newSession(await newUser(), null)

    const devices = await listDevices(userId, laptop)

    expect(devices).toHaveLength(2)
    expect(devices).toContainEqual(
      expect.objectContaining({
        id: phone,
        device: 'Chrome on Android',
        current: false,
      }),
    )
    expect(devices).toContainEqual(
      expect.objectContaining({ id: laptop, current: true }),
    )
    expect(devices[0]).not.toHaveProperty('token')
  })

  it("signs out the user's own session and ignores another user's", async () => {
    const userId = await newUser()
    const own = await newSession(userId, null)
    const otherUser = await newUser()
    const others = await newSession(otherUser, null)

    await signOutDevice(userId, own)
    await signOutDevice(userId, others)

    expect(await listDevices(userId, '')).toEqual([])
    expect(await listDevices(otherUser, '')).toHaveLength(1)
  })
})
