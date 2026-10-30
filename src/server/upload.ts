import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  bodySchema,
  dueSchema,
  entryTextSchema,
  itemTypes,
  prioritySchema,
  repeatSchema,
  statusSchema,
  titleSchema,
} from '#/data/schema'
import { db } from '#/server/db'
import {
  type ActivityAction,
  activity,
  entries,
  items,
  noteVersion,
  space,
  spaceMember,
} from '#/server/db/schema'

// Applies a batch from the client's PowerSync upload queue. The server is the authority: every
// operation is validated and checked against space membership before it touches the database.
//
// Outcomes per operation:
//   applied   written
//   skipped   nothing to do, and not a problem: a row made before the user had an account (it is
//             re-sent with its space when claimed), or a row that is already gone
//   rejected  not allowed or not valid; the client is told, and the next sync replaces its copy
//             with the server's

export const operationSchema = z.object({
  op: z.enum(['PUT', 'PATCH', 'DELETE']),
  table: z.enum(['items', 'entries']),
  id: z.uuid(),
  data: z.record(z.string(), z.unknown()).nullish(),
})

export const uploadSchema = z.object({
  operations: z.array(operationSchema).max(1000),
})

export type Operation = z.infer<typeof operationSchema>
export type Rejection = Pick<Operation, 'op' | 'table' | 'id'> & {
  reason: 'forbidden' | 'invalid'
}

const date = z.iso.datetime().transform((value) => new Date(value))
const nullableDate = date.nullable()

// Field rules without defaults: a PATCH carries only the changed fields, and a default here would
// silently reset the others. Defaults apply to a PUT only, for columns the client left empty.
const itemFields = z.object({
  type: z.enum(itemTypes),
  title: titleSchema,
  body: bodySchema,
  completed_at: nullableDate,
  pinned_at: nullableDate,
  priority: prioritySchema,
  status: statusSchema,
  due_on: dueSchema,
  repeat: repeatSchema,
  snoozed_until: dueSchema,
  assigned_to: z.string().min(1).nullable(),
  archived_at: nullableDate,
  deleted_at: nullableDate,
  created_at: date,
  updated_at: date,
})

const itemPut = itemFields.extend({
  space_id: z.uuid(),
  body: bodySchema.default(''),
  completed_at: nullableDate.default(null),
  pinned_at: nullableDate.default(null),
  priority: prioritySchema.default(0),
  status: statusSchema.default(null),
  due_on: dueSchema.default(null),
  repeat: repeatSchema.default(null),
  snoozed_until: dueSchema.default(null),
  assigned_to: z.string().min(1).nullable().default(null),
  archived_at: nullableDate.default(null),
  deleted_at: nullableDate.default(null),
})

const entryFields = z.object({
  text: entryTextSchema,
  completed_at: nullableDate,
  position: z.number().finite(),
  created_at: date,
  updated_at: date,
})

const entryPut = entryFields.extend({
  item_id: z.uuid(),
  space_id: z.uuid(),
  completed_at: nullableDate.default(null),
  position: z.number().finite().default(0),
})

// Moving a row to another space or list is not an edit, so a PATCH cannot change those columns
// (unknown keys are dropped); the client re-sends a moved row as a DELETE and a PUT.
const itemPatch = itemFields.partial()

// Who checked or deleted a row is the uploader, never a value from the client; undefined (the
// timestamp is not in this change) leaves it as it is. A moved row (DELETE plus PUT) is credited
// to whoever moved it.
const markedBy = (at: Date | null | undefined, userId: string) =>
  at === undefined ? undefined : at ? userId : null
const entryPatch = entryFields.partial()

const toggled = (
  at: Date | null | undefined,
  on: ActivityAction,
  off: ActivityAction,
) => (at === undefined ? undefined : at ? on : off)

/** What a PATCH means to the other members; undefined for changes not worth a line (a pin). */
function itemAction(patch: z.output<typeof itemPatch>) {
  const { title, body, type, due_on, repeat, status, priority, assigned_to } =
    patch
  return (
    toggled(patch.deleted_at, 'trashed', 'restored') ??
    toggled(patch.completed_at, 'completed', 'reopened') ??
    toggled(patch.archived_at, 'archived', 'unarchived') ??
    ([title, body, type, due_on, repeat, status, priority, assigned_to].some(
      (v) => v !== undefined,
    )
      ? 'edited'
      : undefined)
  )
}

const entryAction = (patch: z.output<typeof entryPatch>) =>
  toggled(patch.completed_at, 'completed', 'reopened') ??
  (patch.text !== undefined ? 'edited' : undefined)

// The same change repeated within this time (typing in a note, saved as it goes) is one line.
const foldWithin = 10 * 60 * 1000

type Log = (
  spaceId: string,
  itemId: string,
  entryId: string | null,
  action: ActivityAction | undefined,
) => Promise<void>

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

class Rejected extends Error {
  constructor(readonly reason: Rejection['reason']) {
    super(reason)
  }
}

/** Unowned rows exist only on a device without an account; the claim re-sends them with a space. */
const isUnowned = (data: Operation['data']) => data?.space_id == null

function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data ?? {})
  if (!result.success) throw new Rejected('invalid')
  return result.data
}

export async function applyUpload(userId: string, operations: Operation[]) {
  const rejected: Rejection[] = []
  let applied = 0
  let skipped = 0

  await db.transaction(async (tx) => {
    const roles = new Map<string, boolean>()

    async function requireEditor(spaceId: string) {
      if (!roles.has(spaceId)) {
        const [membership] = await tx
          .select({ role: spaceMember.role })
          .from(spaceMember)
          .where(
            and(
              eq(spaceMember.spaceId, spaceId),
              eq(spaceMember.userId, userId),
            ),
          )
        roles.set(
          spaceId,
          membership?.role === 'owner' || membership?.role === 'editor',
        )
      }
      if (!roles.get(spaceId)) throw new Rejected('forbidden')
    }

    // Only shared spaces keep a log: in a personal space the only one acting is its owner.
    const shared = new Map<string, boolean>()
    const log: Log = async (spaceId, itemId, entryId, action) => {
      if (!action) return
      if (!shared.has(spaceId)) {
        const [found] = await tx
          .select({ personalOwnerId: space.personalOwnerId })
          .from(space)
          .where(eq(space.id, spaceId))
        shared.set(spaceId, found !== undefined && !found.personalOwnerId)
      }
      if (!shared.get(spaceId)) return

      const [last] = await tx
        .select()
        .from(activity)
        .where(eq(activity.spaceId, spaceId))
        .orderBy(desc(activity.at))
        .limit(1)
      const now = new Date()
      if (
        last &&
        last.userId === userId &&
        last.itemId === itemId &&
        last.entryId === entryId &&
        last.action === action &&
        now.getTime() - last.at.getTime() < foldWithin
      ) {
        await tx
          .update(activity)
          .set({ at: now })
          .where(eq(activity.id, last.id))
      } else {
        await tx
          .insert(activity)
          .values({ spaceId, userId, itemId, entryId, action, at: now })
      }
    }

    // A move re-sends an item as a DELETE and then a PUT (`moveItem`). Keeping the row instead
    // keeps its history, and a PUT the server refuses cannot lose the item.
    const lastPut = new Map(
      operations.flatMap((operation, index) =>
        operation.table === 'items' && operation.op === 'PUT'
          ? [[operation.id, index] as const]
          : [],
      ),
    )

    for (const [index, operation] of operations.entries()) {
      const moving =
        operation.table === 'items' &&
        operation.op === 'DELETE' &&
        (lastPut.get(operation.id) ?? -1) > index
      try {
        // A savepoint per operation: a failure undoes only that operation.
        const outcome = moving
          ? 'skipped'
          : await tx.transaction((savepoint) =>
              applyOperation(savepoint, operation, userId, requireEditor, log),
            )
        if (outcome === 'applied') applied += 1
        else skipped += 1
      } catch (error) {
        if (error instanceof Rejected) {
          rejected.push({ ...pick(operation), reason: error.reason })
        } else if (isConstraintViolation(error)) {
          rejected.push({ ...pick(operation), reason: 'invalid' })
        } else {
          throw error
        }
      }
    }
  })

  return { applied, skipped, rejected }
}

const pick = ({ op, table, id }: Operation) => ({ op, table, id })

// Postgres class 23: integrity constraint violations (checks, foreign keys, not null).
const isConstraintViolation = (error: unknown) => {
  const { code, cause } = error as {
    code?: unknown
    cause?: { code?: unknown }
  }
  const sqlState = cause?.code ?? code
  return typeof sqlState === 'string' && sqlState.startsWith('23')
}

/** Drizzle cannot run an UPDATE without values; a PATCH with no known fields changes nothing. */
const hasValues = (values: Record<string, unknown>) =>
  Object.values(values).some((value) => value !== undefined)

/**
 * Keeps the text as a version to restore. Saves by the same member within `foldWithin` replace
 * their last version, so one editing session (saved every few seconds) is one version.
 */
async function recordVersion(
  tx: Tx,
  itemId: string,
  body: string | undefined,
  userId: string,
) {
  if (body === undefined) return
  const [last] = await tx
    .select()
    .from(noteVersion)
    .where(eq(noteVersion.itemId, itemId))
    .orderBy(desc(noteVersion.savedAt))
    .limit(1)
  if (last ? last.body === body : !body) return
  const now = new Date()
  if (
    last &&
    last.savedBy === userId &&
    now.getTime() - last.savedAt.getTime() < foldWithin
  ) {
    await tx
      .update(noteVersion)
      .set({ body, savedAt: now })
      .where(eq(noteVersion.id, last.id))
  } else {
    await tx
      .insert(noteVersion)
      .values({ itemId, body, savedBy: userId, savedAt: now })
  }
}

/** A task can be for any member of its space, and nobody else. */
async function isAssignable(
  tx: Tx,
  spaceId: string,
  assignee: string | null | undefined,
) {
  if (!assignee) return true
  const [member] = await tx
    .select({ userId: spaceMember.userId })
    .from(spaceMember)
    .where(
      and(eq(spaceMember.spaceId, spaceId), eq(spaceMember.userId, assignee)),
    )
  return member !== undefined
}

/**
 * An item that changes space leaves the old space's log behind, so its members no longer see
 * it. Earlier texts go with it only out of a personal space, where all of them are the mover's.
 */
async function leaveSpace(tx: Tx, itemId: string, from: string) {
  await tx
    .delete(activity)
    .where(and(eq(activity.itemId, itemId), eq(activity.spaceId, from)))
  const [old] = await tx
    .select({ personalOwnerId: space.personalOwnerId })
    .from(space)
    .where(eq(space.id, from))
  if (!old?.personalOwnerId) {
    await tx.delete(noteVersion).where(eq(noteVersion.itemId, itemId))
  }
}

async function applyOperation(
  tx: Tx,
  { op, table, id, data }: Operation,
  userId: string,
  requireEditor: (spaceId: string) => Promise<void>,
  log: Log,
): Promise<'applied' | 'skipped'> {
  if (table === 'items') {
    const [existing] = await tx
      .select({ spaceId: items.spaceId })
      .from(items)
      .where(eq(items.id, id))

    if (op === 'PUT') {
      if (isUnowned(data)) return 'skipped'
      const row = parse(itemPut, data)
      await requireEditor(row.space_id)
      if (existing) await requireEditor(existing.spaceId)
      if (existing && existing.spaceId !== row.space_id) {
        await leaveSpace(tx, id, existing.spaceId)
      }
      // Someone who is not in the target space (removed a moment ago) leaves the task unassigned
      // instead of the whole move being refused.
      const assignedTo = (await isAssignable(tx, row.space_id, row.assigned_to))
        ? row.assigned_to
        : null
      const values = {
        spaceId: row.space_id,
        type: row.type,
        title: row.title,
        body: row.body,
        completedAt: row.completed_at,
        completedBy: markedBy(row.completed_at, userId),
        pinnedAt: row.pinned_at,
        priority: row.priority,
        status: row.status,
        dueOn: row.due_on,
        repeat: row.repeat,
        snoozedUntil: row.snoozed_until,
        assignedTo,
        archivedAt: row.archived_at,
        deletedAt: row.deleted_at,
        deletedBy: markedBy(row.deleted_at, userId),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
      await tx
        .insert(items)
        .values({ id, createdBy: userId, ...values })
        .onConflictDoUpdate({ target: items.id, set: values })
      if (!existing) await log(row.space_id, id, null, 'added')
      await recordVersion(tx, id, row.body, userId)
      return 'applied'
    }

    if (!existing) return 'skipped'
    await requireEditor(existing.spaceId)

    if (op === 'DELETE') {
      await tx.delete(items).where(eq(items.id, id))
      return 'applied'
    }

    const patch = parse(itemPatch, data)
    if (!(await isAssignable(tx, existing.spaceId, patch.assigned_to))) {
      throw new Rejected('invalid')
    }
    const values = {
      type: patch.type,
      title: patch.title,
      body: patch.body,
      completedAt: patch.completed_at,
      completedBy: markedBy(patch.completed_at, userId),
      pinnedAt: patch.pinned_at,
      priority: patch.priority,
      status: patch.status,
      dueOn: patch.due_on,
      repeat: patch.repeat,
      snoozedUntil: patch.snoozed_until,
      assignedTo: patch.assigned_to,
      archivedAt: patch.archived_at,
      deletedAt: patch.deleted_at,
      deletedBy: markedBy(patch.deleted_at, userId),
      createdAt: patch.created_at,
      updatedAt: patch.updated_at,
    }
    if (!hasValues(values)) return 'skipped'
    await tx.update(items).set(values).where(eq(items.id, id))
    await log(existing.spaceId, id, null, itemAction(patch))
    await recordVersion(tx, id, patch.body, userId)
    return 'applied'
  }

  const [existing] = await tx
    .select({ spaceId: entries.spaceId, itemId: entries.itemId })
    .from(entries)
    .where(eq(entries.id, id))

  if (op === 'PUT') {
    if (isUnowned(data)) return 'skipped'
    const row = parse(entryPut, data)
    // An entry lives in its list's space; the list must exist and agree.
    const [parent] = await tx
      .select({ spaceId: items.spaceId })
      .from(items)
      .where(eq(items.id, row.item_id))
    if (!parent || parent.spaceId !== row.space_id) {
      throw new Rejected('invalid')
    }
    await requireEditor(row.space_id)
    if (existing) await requireEditor(existing.spaceId)
    if (existing && existing.spaceId !== row.space_id) {
      await tx.delete(activity).where(eq(activity.entryId, id))
    }
    const values = {
      itemId: row.item_id,
      spaceId: row.space_id,
      text: row.text,
      completedAt: row.completed_at,
      completedBy: markedBy(row.completed_at, userId),
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    await tx
      .insert(entries)
      .values({ id, ...values })
      .onConflictDoUpdate({ target: entries.id, set: values })
    if (!existing) await log(row.space_id, row.item_id, id, 'added')
    return 'applied'
  }

  if (!existing) return 'skipped'
  await requireEditor(existing.spaceId)

  if (op === 'DELETE') {
    await tx.delete(entries).where(eq(entries.id, id))
    return 'applied'
  }

  const patch = parse(entryPatch, data)
  const values = {
    text: patch.text,
    completedAt: patch.completed_at,
    completedBy: markedBy(patch.completed_at, userId),
    position: patch.position,
    createdAt: patch.created_at,
    updatedAt: patch.updated_at,
  }
  if (!hasValues(values)) return 'skipped'
  await tx.update(entries).set(values).where(eq(entries.id, id))
  await log(existing.spaceId, existing.itemId, id, entryAction(patch))
  return 'applied'
}
