import { column, Schema, Table } from '@powersync/common'
import { z } from 'zod'

// The page's Content-Security-Policy forbids eval, so Zod must not probe for it with `Function`
// (the probe fails safely but is reported as a violation). The server keeps Zod's faster parsers.
if (typeof window !== 'undefined') z.config({ jitless: true })

// PowerSync adds the text `id` column itself. Timestamps are ISO 8601 strings, and completion is
// stored as a timestamp so it records when something was done, not only whether.

// `space_id` is null while the user has no account: such rows exist only on this device until
// they are claimed at sign-up (see `claimLocalData` in store.ts).

const items = new Table(
  {
    space_id: column.text,
    created_by: column.text,
    type: column.text,
    title: column.text,
    body: column.text,
    completed_at: column.text,
    completed_by: column.text,
    pinned_at: column.text,
    priority: column.integer,
    status: column.text,
    due_on: column.text,
    repeat: column.text,
    archived_at: column.text,
    deleted_at: column.text,
    deleted_by: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { created: ['created_at'], space: ['space_id'] } },
)

const entries = new Table(
  {
    item_id: column.text,
    space_id: column.text,
    text: column.text,
    completed_at: column.text,
    completed_by: column.text,
    position: column.real,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { item: ['item_id'] } },
)

// Spaces and memberships arrive from the server only; the app never writes them locally (sharing
// changes go through server functions), so they are never in the upload queue.

const space = new Table({
  name: column.text,
  personal_owner_id: column.text,
  created_at: column.text,
  updated_at: column.text,
})

const space_member = new Table(
  {
    space_id: column.text,
    user_id: column.text,
    role: column.text,
    member_name: column.text,
  },
  { indexes: { space: ['space_id'] } },
)

export const appSchema = new Schema({ items, entries, space, space_member })

export const itemTypes = ['note', 'list', 'task'] as const

export type ItemType = (typeof itemTypes)[number]

/** 0 is no priority, so priorities sort as plain numbers. */
export const priorities = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
] as const

export type Priority = (typeof priorities)[number]['value']

export const prioritySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
])

/** Where a task that takes a while stands. Null is "to do"; done is `completed_at`, not a status. */
export const taskStatuses = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
] as const

export type TaskStatus = (typeof taskStatuses)[number]['value']

export const statusSchema = z.enum(['in_progress', 'waiting']).nullable()

/** A calendar day (`2026-10-30`), not a moment: due "on Friday" stays Friday in every time zone. */
export const dueSchema = z.iso.date().nullable()

export const repeatChoices = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

export const repeatSchema = z.enum(['daily', 'weekly', 'monthly']).nullable()
export type Repeat = NonNullable<z.infer<typeof repeatSchema>>

export const statusLabel = (status: TaskStatus) =>
  taskStatuses.find(({ value }) => value === status)?.label

export const itemSchema = z.object({
  id: z.string(),
  space_id: z.string().nullable(),
  created_by: z.string().nullable(),
  // A type from a newer version reads as a note (title and text still show): one row that fails
  // here fails the whole batch the collection loads, so nothing in this schema may refuse a row
  // over a value it does not know.
  type: z.enum(itemTypes).catch('note'),
  title: z.string(),
  body: z.string(),
  completed_at: z.string().nullable(),
  // Set by the server to whoever checked it; the client fills it in early for its own checks.
  completed_by: z.string().nullable(),
  pinned_at: z.string().nullable(),
  // Rows written before a column existed have no value, and a newer version of the app may sync
  // values this one does not know (A-08). Such a row shows the field as unset;
  // edits write only the columns they change, so the newer value is kept until someone changes it.
  // Writes are validated by the input schemas, and the server by its own.
  priority: prioritySchema.catch(0),
  status: statusSchema.catch(null),
  due_on: dueSchema.catch(null),
  // A finished repeating task stays open with its due day moved on.
  repeat: repeatSchema.catch(null),
  archived_at: z.string().nullable(),
  // In the trash since then. Set by the server to whoever deleted it, like `completed_by`.
  deleted_at: z.string().nullable(),
  deleted_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Item = z.infer<typeof itemSchema>

export const entrySchema = z.object({
  id: z.string(),
  item_id: z.string(),
  space_id: z.string().nullable(),
  text: z.string(),
  completed_at: z.string().nullable(),
  completed_by: z.string().nullable(),
  // Sort key within a list. Real numbers leave room to move an entry between two others later.
  position: z
    .number()
    .nullable()
    .transform((value) => value ?? 0),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Entry = z.infer<typeof entrySchema>

export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Add a title')
  .max(200, 'Keep the title under 200 characters')
export const bodySchema = z.string().trim().max(20_000)
export const entryTextSchema = z
  .string()
  .trim()
  .min(1, 'Add some text')
  .max(500)

export const newItemSchema = z
  .object({
    type: z.enum(itemTypes),
    title: titleSchema,
    body: bodySchema.default(''),
    entries: z.array(entryTextSchema).max(500).default([]),
  })
  .refine((item) => item.type === 'list' || item.entries.length === 0, {
    message: 'Only lists have entries',
    path: ['entries'],
  })

export type NewItem = z.input<typeof newItemSchema>

/** Who new items belong to on this device: set after sign-in, null without an account. */
export type Owner = { userId: string; spaceId: string }

export const memberRoles = ['owner', 'editor', 'viewer'] as const
export type MemberRole = (typeof memberRoles)[number]

export const spaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  personal_owner_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Space = z.infer<typeof spaceSchema>

export const memberSchema = z.object({
  id: z.string(),
  space_id: z.string(),
  user_id: z.string(),
  // A role from a newer version reads as the least one; the server decides what is allowed.
  role: z.enum(memberRoles).catch('viewer'),
  member_name: z.string(),
})

export type Member = z.infer<typeof memberSchema>
