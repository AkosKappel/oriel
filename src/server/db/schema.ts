import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
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
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.userId] }), index().on(t.userId)],
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
    pinnedAt: timestamp({ withTimezone: true }),
    priority: smallint().default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    index().on(t.spaceId),
    check('items_type', sql`${t.type} in ('note', 'list', 'task')`),
    check('items_priority', sql`${t.priority} between 0 and 3`),
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
    position: doublePrecision().default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    index().on(t.itemId),
    index().on(t.spaceId),
    check('entries_text_length', sql`char_length(${t.text}) between 1 and 500`),
  ],
)
