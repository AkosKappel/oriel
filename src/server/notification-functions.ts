import { createServerFn } from '@tanstack/react-start'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { env } from '#/env'
import { db } from '#/server/db'
import { pushSubscription } from '#/server/db/schema'
import { localClock } from '#/server/notification-rules'
import { signedIn } from '#/server/signed-in'

// Settings, Notifications. Offered only when the server has a VAPID key pair. A device is
// subscribed while it wants at least one kind; turning both off removes it.

export const getNotificationKey = createServerFn({ method: 'GET' }).handler(
  () => env.VAPID_PUBLIC_KEY ?? null,
)

const choices = z.object({ reminders: z.boolean(), changes: z.boolean() })

/** What this device asked for, or null when it is not subscribed (for this user). */
export const getDeviceNotifications = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ endpoint: z.string().max(2000) }))
  .handler(async ({ context, data }) => {
    const [found] = await db
      .select({
        reminders: pushSubscription.reminders,
        changes: pushSubscription.changes,
      })
      .from(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, context.userId),
          eq(pushSubscription.endpoint, data.endpoint),
        ),
      )
    return found ?? null
  })

export const saveSubscription = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(
    choices.extend({
      endpoint: z.url().max(2000),
      keys: z.object({
        p256dh: z.string().min(1).max(200),
        auth: z.string().min(1).max(100),
      }),
      timeZone: z
        .string()
        .max(64)
        .refine((zone) => localClock(new Date(), zone) !== null),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!env.VAPID_PUBLIC_KEY) {
      throw new Error('Notifications are off on this server.')
    }
    const values = {
      userId: context.userId,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      timeZone: data.timeZone,
      reminders: data.reminders,
      changes: data.changes,
    }
    // Changes count from when they are turned on, so what happened before is not sent; changing
    // the other setting leaves pending changes alone.
    await db
      .insert(pushSubscription)
      .values(values)
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: {
          ...values,
          changesSince: sql`case when ${pushSubscription.changes} then ${pushSubscription.changesSince} else now() end`,
        },
      })
  })

/** Moves the morning reminder to the zone the device is in now (after travel). */
export const updateTimeZone = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(
    z.object({
      endpoint: z.string().max(2000),
      timeZone: z
        .string()
        .max(64)
        .refine((zone) => localClock(new Date(), zone) !== null),
    }),
  )
  .handler(async ({ context, data }) => {
    await db
      .update(pushSubscription)
      .set({ timeZone: data.timeZone })
      .where(
        and(
          eq(pushSubscription.userId, context.userId),
          eq(pushSubscription.endpoint, data.endpoint),
        ),
      )
  })

export const removeSubscription = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ endpoint: z.string().max(2000) }))
  .handler(async ({ context, data }) => {
    await db
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, context.userId),
          eq(pushSubscription.endpoint, data.endpoint),
        ),
      )
  })
