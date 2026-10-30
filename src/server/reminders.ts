import { and, asc, desc, eq, isNull, lte, or } from 'drizzle-orm'
import webpush from 'web-push'
import { env } from '#/env'
import { db } from '#/server/db'
import { items, pushSubscription, spaceMember } from '#/server/db/schema'
import { localClock, reminderMessage } from '#/server/reminder-rules'

// Morning reminders (Web Push): once a day per device, from 08:00 in the device's time zone, the
// open tasks due by that day. Run every quarter hour from the server entry (src/server.ts);
// `remindedOn` records what went out, so restarts and overlapping runs never send twice.
const morning = 8

/**
 * Open tasks due by `day` (overdue ones too) in the user's spaces that are for them or for
 * anyone, leaving out what is archived, trashed or snoozed past that day.
 */
export async function dueTasks(userId: string, day: string) {
  const rows = await db
    .select({ title: items.title })
    .from(items)
    .innerJoin(
      spaceMember,
      and(
        eq(spaceMember.spaceId, items.spaceId),
        eq(spaceMember.userId, userId),
      ),
    )
    .where(
      and(
        eq(items.type, 'task'),
        isNull(items.completedAt),
        isNull(items.archivedAt),
        isNull(items.deletedAt),
        lte(items.dueOn, day),
        or(isNull(items.snoozedUntil), lte(items.snoozedUntil, day)),
        or(isNull(items.assignedTo), eq(items.assignedTo, userId)),
      ),
    )
    .orderBy(asc(items.dueOn), desc(items.priority), asc(items.createdAt))
  return rows.map((row) => row.title)
}

let running = false

export async function runReminders(now = new Date()) {
  if (running || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return
  running = true
  try {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    )
    const subscriptions = await db.select().from(pushSubscription)
    for (const subscription of subscriptions) {
      const clock = localClock(now, subscription.timeZone)
      if (!clock || clock.hour < morning) continue
      if (subscription.remindedOn && subscription.remindedOn >= clock.day)
        continue
      const message = reminderMessage(
        await dueTasks(subscription.userId, clock.day),
      )
      if (message)
        await send(subscription, { ...message, tag: `due-${clock.day}` })
      await db
        .update(pushSubscription)
        .set({ remindedOn: clock.day })
        .where(eq(pushSubscription.id, subscription.id))
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'reminders failed',
        error: String(error),
      }),
    )
  } finally {
    running = false
  }
}

async function send(
  subscription: typeof pushSubscription.$inferSelect,
  message: { title: string; body: string; url: string; tag: string },
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(message),
      { TTL: 12 * 3600 },
    )
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    // Gone or unknown: the browser dropped the subscription.
    if (status === 404 || status === 410) {
      await db
        .delete(pushSubscription)
        .where(eq(pushSubscription.id, subscription.id))
    } else {
      console.error(
        JSON.stringify({
          level: 'warn',
          msg: 'push not sent',
          status,
          error: status ? undefined : String(error),
        }),
      )
    }
  }
}
