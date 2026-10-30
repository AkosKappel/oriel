import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { env } from '#/env'
import { db } from '#/server/db'
import { pushSubscription } from '#/server/db/schema'
import { localClock } from '#/server/reminder-rules'
import { signedIn } from '#/server/signed-in'

// Settings, Reminders. Offered only when the server has a VAPID key pair.

export const getReminderKey = createServerFn({ method: 'GET' }).handler(
  () => env.VAPID_PUBLIC_KEY ?? null,
)

export const saveSubscription = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(
    z.object({
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
    if (!env.VAPID_PUBLIC_KEY)
      throw new Error('Reminders are off on this server.')
    const values = {
      userId: context.userId,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      timeZone: data.timeZone,
    }
    await db
      .insert(pushSubscription)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscription.endpoint, set: values })
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
