import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// Column names are snake_case in the database (`casing` in drizzle.config.ts and the client).

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

// Better Auth core tables (email and password). Ids are Better Auth's own strings.

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().default(false).notNull(),
  image: text(),
  ...timestamps,
})

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.identifier)],
)

// Better Auth's passkey plugin: one row per registered WebAuthn credential.
export const passkey = pgTable(
  'passkey',
  {
    id: text().primaryKey(),
    name: text(),
    publicKey: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull().unique(),
    counter: bigint({ mode: 'number' }).notNull(),
    deviceType: text().notNull(),
    backedUp: boolean().notNull(),
    transports: text(),
    createdAt: timestamp({ withTimezone: true }).defaultNow(),
    aaguid: text(),
  },
  (t) => [index().on(t.userId)],
)

// Spaces own content. Every user has one personal space; shared spaces come with sharing
// (phase 8). Access to items and entries always goes through space membership.

export const space = pgTable('space', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  // Set only on a personal space: one per user, so creating it is safe to retry.
  personalOwnerId: text()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  ...timestamps,
})

export const memberRole = pgEnum('member_role', ['owner', 'editor', 'viewer'])

export const spaceMember = pgTable(
  'space_member',
  {
    spaceId: uuid()
      .notNull()
      .references(() => space.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: memberRole().notNull(),
    // Copied from the user at join, so devices can show who did what without the user table
    // (and its emails) ever being replicated.
    memberName: text().notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.userId] }), index().on(t.userId)],
)

// An invite link to a shared space. Only a hash of the token is stored: the link itself is shown
// once to the owner who made it. Single use, and it expires.
export const invite = pgTable(
  'invite',
  {
    id: uuid().primaryKey().defaultRandom(),
    spaceId: uuid()
      .notNull()
      .references(() => space.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    role: memberRole().notNull(),
    // Set when the invite was emailed, so owners see who an open link is for.
    email: text(),
    createdBy: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedBy: text().references(() => user.id, { onDelete: 'set null' }),
    acceptedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index().on(t.spaceId),
    check('invite_role', sql`${t.role} <> 'owner'`),
  ],
)

// Items and entries mirror the client's PowerSync tables (src/data/schema.ts) and use the
// client's UUIDs as primary keys, so a retried upload updates the row instead of duplicating it.

export const items = pgTable(
  'items',
  {
    id: uuid().primaryKey(),
    spaceId: uuid()
      .notNull()
      .references(() => space.id, { onDelete: 'cascade' }),
    createdBy: text().references(() => user.id, { onDelete: 'set null' }),
    type: text().notNull(),
    title: text().notNull(),
    body: text().default('').notNull(),
    completedAt: timestamp({ withTimezone: true }),
    completedBy: text().references(() => user.id, { onDelete: 'set null' }),
    pinnedAt: timestamp({ withTimezone: true }),
    priority: smallint().default(0).notNull(),
    // Null is to do; done is completedAt.
    status: text(),
    // A calendar day, for tasks.
    dueOn: date({ mode: 'string' }),
    repeat: text(),
    // Off home until this day.
    snoozedUntil: date({ mode: 'string' }),
    assignedTo: text().references(() => user.id, { onDelete: 'set null' }),
    archivedAt: timestamp({ withTimezone: true }),
    // In the trash since then; devices delete it for good after 30 days.
    deletedAt: timestamp({ withTimezone: true }),
    deletedBy: text().references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index().on(t.spaceId),
    check('items_type', sql`${t.type} in ('note', 'list', 'task')`),
    check('items_priority', sql`${t.priority} between 0 and 3`),
    check('items_status', sql`${t.status} in ('in_progress', 'waiting')`),
    check('items_repeat', sql`${t.repeat} in ('daily', 'weekly', 'monthly')`),
    check('items_title_length', sql`char_length(${t.title}) between 1 and 200`),
  ],
)

export const entries = pgTable(
  'entries',
  {
    id: uuid().primaryKey(),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    // Repeated from the item so sync can select a space's entries without a join.
    spaceId: uuid()
      .notNull()
      .references(() => space.id, { onDelete: 'cascade' }),
    text: text().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    completedBy: text().references(() => user.id, { onDelete: 'set null' }),
    position: doublePrecision().default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    index().on(t.itemId),
    index().on(t.spaceId),
    check('entries_text_length', sql`char_length(${t.text}) between 1 and 500`),
  ],
)

export const activityActions = [
  'added',
  'edited',
  'completed',
  'reopened',
  'archived',
  'unarchived',
  'trashed',
  'restored',
] as const
export type ActivityAction = (typeof activityActions)[number]

// Who changed what in a shared space, written by the upload endpoint. It keeps no copies of
// content: titles and entry text are joined at read time, and the rows go with the item or entry.
// Never replicated to devices.
export const activity = pgTable(
  'activity',
  {
    id: uuid().primaryKey().defaultRandom(),
    spaceId: uuid()
      .notNull()
      .references(() => space.id, { onDelete: 'cascade' }),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    // Set when the change was to one entry of a list.
    entryId: uuid().references(() => entries.id, { onDelete: 'cascade' }),
    action: text().$type<ActivityAction>().notNull(),
    at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index().on(t.spaceId, t.at),
    index().on(t.itemId),
    index().on(t.entryId),
  ],
)

// Earlier texts of an item, one per editing session, for restoring. Written by the upload
// endpoint, removed with the item, never replicated.
export const noteVersion = pgTable(
  'note_version',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    savedBy: text().references(() => user.id, { onDelete: 'set null' }),
    savedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index().on(t.itemId, t.savedAt)],
)

// A device that said yes to notifications. The endpoint is unique, so a device that
// changes hands (another user signs in) moves to the new user.
export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    // The device's IANA time zone, so the reminder comes in its morning.
    timeZone: text().notNull(),
    // The device's language: notifications are worded outside any request.
    locale: text().default('en').notNull(),
    // The device's day the last reminder went out, so restarts never send twice.
    remindedOn: date({ mode: 'string' }),
    // What the device asked for: the morning reminder, and changes other members make.
    reminders: boolean().default(true).notNull(),
    changes: boolean().default(false).notNull(),
    // Changes up to this moment have been notified (or were made before the device asked).
    changesSince: timestamp({ withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
)
