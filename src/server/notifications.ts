import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  or,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import webpush from 'web-push'
import { env } from '#/env'
import { describeActivity } from '#/lib/activity'
import { db } from '#/server/db'
import {
  activity,
  entries,
  items,
  pushSubscription,
  spaceMember,
} from '#/server/db/schema'
import {
  changesMessage,
  localClock,
  noticedActions,
  reminderMessage,
} from '#/server/notification-rules'

// Notifications (Web Push), each kind only where the device asked for it:
//   morning reminder  once a day from 08:00 in the device's time zone, the open tasks due by then
//   changes           what other members added or checked off, gathered into one notification
// Run every five minutes from the server entry (src/server.ts). `remindedOn` and `changesSince`
// record what went out, so restarts and overlapping runs never send twice.
const morning = 8
// Changes wait until they are this old, so someone adding a few things is one notification.
const settleMs = 2 * 60_000

const actor = alias(spaceMember, 'actor')
const reader = alias(spaceMember, 'reader')

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

/** What other members added or checked off in the user's spaces, newest first. */
export async function changesFor(userId: string, after: Date, until: Date) {
  const rows = await db
    .select({
      id: activity.id,
      action: activity.action,
      at: activity.at,
      userId: activity.userId,
      memberName: actor.memberName,
      itemId: items.id,
      itemTitle: items.title,
      entryText: entries.text,
    })
    .from(activity)
    .innerJoin(
      reader,
      and(eq(reader.spaceId, activity.spaceId), eq(reader.userId, userId)),
    )
    .innerJoin(items, eq(items.id, activity.itemId))
    .leftJoin(entries, eq(entries.id, activity.entryId))
    .leftJoin(
      actor,
      and(
        eq(actor.spaceId, activity.spaceId),
        eq(actor.userId, activity.userId),
      ),
    )
    .where(
      and(
        ne(activity.userId, userId),
        inArray(activity.action, [...noticedActions]),
        gt(activity.at, after),
        lte(activity.at, until),
      ),
    )
    .orderBy(desc(activity.at))
  return rows.map(({ at, ...row }) => ({ ...row, at: at.toISOString() }))
}

let running = false

export async function runNotifications(now = new Date()) {
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
      if (subscription.changes) await noticeChanges(subscription, now)
      if (!subscription.reminders) continue
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
        msg: 'notifications failed',
        error: String(error),
      }),
    )
  } finally {
    running = false
  }
}

async function noticeChanges(
  subscription: typeof pushSubscription.$inferSelect,
  now: Date,
) {
  const until = new Date(now.getTime() - settleMs)
  if (until <= subscription.changesSince) return
  const message = changesMessage(
    describeActivity(
      await changesFor(subscription.userId, subscription.changesSince, until),
    ),
  )
  // One tag: a newer summary replaces an unread one instead of piling up.
  if (message) await send(subscription, { ...message, tag: 'changes' })
  await db
    .update(pushSubscription)
    .set({ changesSince: until })
    .where(eq(pushSubscription.id, subscription.id))
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
