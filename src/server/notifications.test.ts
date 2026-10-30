import { createECDH, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import webpush from 'web-push'
import {
  changesMessage,
  localClock,
  reminderMessage,
} from './notification-rules'

describe('localClock', () => {
  it('reads the day and hour in a time zone', () => {
    const now = new Date('2026-10-30T23:30:00Z')
    expect(localClock(now, 'Europe/Bratislava')).toEqual({
      day: '2026-10-31',
      hour: 0,
    })
    expect(localClock(now, 'America/New_York')).toEqual({
      day: '2026-10-30',
      hour: 19,
    })
    expect(localClock(now, 'Mars/Olympus')).toBeNull()
  })
})

describe('reminderMessage', () => {
  it('names up to three tasks and counts the rest', () => {
    expect(reminderMessage([])).toBeNull()
    expect(reminderMessage(['Call the vet'])).toMatchObject({
      title: 'A task for today',
      body: 'Call the vet',
    })
    expect(reminderMessage(['A', 'B', 'C', 'D', 'E'])).toMatchObject({
      title: '5 tasks for today',
      body: 'A, B, C and 2 more',
      url: '/app?type=task&due=today',
    })
  })
})

describe('changesMessage', () => {
  const sentence = (before: string, title: string, after = '') => ({
    key: title,
    at: '2026-10-30T10:00:00.000Z',
    before,
    itemId: `id-${title}`,
    title,
    after,
  })

  it('opens the item for one change and the notebook for several', () => {
    expect(changesMessage([])).toBeNull()
    expect(
      changesMessage([sentence('Anna added Milk and Eggs to', 'Groceries')]),
    ).toEqual({
      title: 'Groceries',
      body: 'Anna added Milk and Eggs to Groceries',
      url: '/items/id-Groceries',
    })
    expect(
      changesMessage([
        sentence('Anna checked Milk in', 'Groceries'),
        sentence('Ben added', 'Pack for the trip'),
        sentence('Ben moved', 'Old list', 'to the trash'),
      ]),
    ).toEqual({
      title: '3 changes in your spaces',
      body: 'Anna checked Milk in Groceries. Ben added Pack for the trip, and 1 more.',
      url: '/app',
    })
  })
})

// Needs the database (`docker compose up -d db` and `npm run db:migrate`).
describe.skipIf(!process.env.DATABASE_URL)('runNotifications', async () => {
  const keys = webpush.generateVAPIDKeys()
  process.env.VAPID_PUBLIC_KEY = keys.publicKey
  process.env.VAPID_PRIVATE_KEY = keys.privateKey
  const { db } = await import('#/server/db')
  const { items, pushSubscription, user } = await import('#/server/db/schema')
  const { ensurePersonalSpace } = await import('#/server/spaces')
  const { dueTasks, runNotifications } = await import('#/server/notifications')

  // The push service is the network; what web-push is asked to send is checked instead.
  const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
    statusCode: 201,
    body: '',
    headers: {},
  })
  let userId: string
  let spaceId: string

  beforeAll(async () => {
    userId = `test-${crypto.randomUUID()}`
    await db
      .insert(user)
      .values({ id: userId, name: 'Test', email: `${userId}@example.com` })
    spaceId = await ensurePersonalSpace(userId)
  })

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, userId))
    send.mockRestore()
  })

  const task = (title: string, overrides = {}) => ({
    id: crypto.randomUUID(),
    spaceId,
    type: 'task',
    title,
    ...overrides,
  })

  it('picks open tasks due by the day, for the user or for anyone', async () => {
    await db
      .insert(items)
      .values([
        task('Overdue', { dueOn: '2026-10-29' }),
        task('Today, high', { dueOn: '2026-10-30', priority: 3 }),
        task('Tomorrow', { dueOn: '2026-10-31' }),
        task('Done', { dueOn: '2026-10-30', completedAt: new Date() }),
        task('Snoozed', { dueOn: '2026-10-30', snoozedUntil: '2026-11-02' }),
        task('No day'),
      ])
    expect(await dueTasks(userId, '2026-10-30')).toEqual([
      'Overdue',
      'Today, high',
    ])
    // Only members of the space get its tasks.
    expect(await dueTasks('someone-else', '2026-10-30')).toEqual([])
  })

  it('sends once a day from 08:00 in the device time zone', async () => {
    const device = createECDH('prime256v1')
    device.generateKeys()
    await db.insert(pushSubscription).values({
      userId,
      endpoint: `https://push.example.com/${crypto.randomUUID()}`,
      p256dh: device.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
      timeZone: 'Europe/Bratislava',
    })

    // 06:00 in Bratislava: too early.
    await runNotifications(new Date('2026-10-30T05:00:00Z'))
    expect(send).not.toHaveBeenCalled()

    await runNotifications(new Date('2026-10-30T07:30:00Z'))
    await runNotifications(new Date('2026-10-30T09:00:00Z'))
    expect(send).toHaveBeenCalledTimes(1)
    const [subscription, payload, options] = send.mock.calls[0]
    expect(JSON.parse(String(payload))).toEqual({
      title: '2 tasks for today',
      body: 'Overdue and Today, high',
      url: '/app?type=task&due=today',
      tag: 'due-2026-10-30',
    })
    // The real request: encrypted for the device and signed with the server's key.
    const request = webpush.generateRequestDetails(
      subscription,
      String(payload),
      {
        ...options,
        vapidDetails: {
          subject: 'mailto:admin@example.com',
          publicKey: keys.publicKey,
          privateKey: keys.privateKey,
        },
      },
    )
    expect(request.headers['Content-Encoding']).toBe('aes128gcm')
    expect(String(request.headers.Authorization)).toMatch(/^vapid t=/)
    const [saved] = await db
      .select({ remindedOn: pushSubscription.remindedOn })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId))
    expect(saved.remindedOn).toBe('2026-10-30')
  })

  it('gathers what other members added or checked off since the last notice', async () => {
    const { applyUpload } = await import('#/server/upload')
    const { createSharedSpace } = await import('#/server/sharing')
    const { space, spaceMember } = await import('#/server/db/schema')
    const bob = `test-${crypto.randomUUID()}`
    await db
      .insert(user)
      .values({ id: bob, name: 'Bob', email: `${bob}@example.com` })
    const home = await createSharedSpace(userId, 'Home')
    await db
      .insert(spaceMember)
      .values({ spaceId: home, userId: bob, role: 'editor', memberName: 'Bob' })
    const device = createECDH('prime256v1')
    device.generateKeys()
    const endpoint = `https://push.example.com/${crypto.randomUUID()}`
    await db.insert(pushSubscription).values({
      userId,
      endpoint,
      p256dh: device.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
      timeZone: 'Europe/Bratislava',
      reminders: false,
      changes: true,
      changesSince: new Date(Date.now() - 60_000),
    })
    const now = new Date().toISOString()
    const row = (data: Record<string, unknown>) => ({
      op: 'PUT' as const,
      id: crypto.randomUUID(),
      data: { space_id: home, created_at: now, updated_at: now, ...data },
    })
    try {
      const list = {
        ...row({ type: 'list', title: 'Groceries' }),
        table: 'items' as const,
      }
      await applyUpload(bob, [list])
      await applyUpload(bob, [
        {
          ...row({ item_id: list.id, text: 'Milk', position: 1 }),
          table: 'entries',
        },
        {
          ...row({ item_id: list.id, text: 'Eggs', position: 2 }),
          table: 'entries',
        },
        {
          op: 'PATCH',
          table: 'items',
          id: list.id,
          data: { title: 'Groceries' },
        },
      ])
      // The user's own change is not news to them.
      await applyUpload(userId, [
        {
          ...row({ item_id: list.id, text: 'Bread', position: 3 }),
          table: 'entries',
        },
      ])

      const sent = () =>
        send.mock.calls
          .filter(([target]) => target.endpoint === endpoint)
          .map(([, payload]) => JSON.parse(String(payload)))
      send.mockClear()
      // Too fresh: someone may still be adding.
      await runNotifications(new Date())
      expect(sent()).toEqual([])

      await runNotifications(new Date(Date.now() + 3 * 60_000))
      expect(sent()).toHaveLength(1)
      const [message] = sent()
      expect(message).toMatchObject({
        title: '2 changes in your spaces',
        url: '/app',
        tag: 'changes',
      })
      expect(message.body).toContain('Bob added Milk and Eggs to Groceries')
      expect(message.body).toContain('Bob added Groceries')
      expect(message.body).not.toContain('Bread')

      await runNotifications(new Date(Date.now() + 6 * 60_000))
      expect(sent()).toHaveLength(1)
    } finally {
      await db.delete(space).where(eq(space.id, home))
      await db.delete(user).where(eq(user.id, bob))
    }
  })
})
