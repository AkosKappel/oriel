import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  bodySchema,
  entryTextSchema,
  itemTypes,
  prioritySchema,
  statusSchema,
  titleSchema,
} from '#/data/schema'
import { db } from '#/server/db'
import { entries, items, spaceMember } from '#/server/db/schema'

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

    for (const operation of operations) {
      try {
        // A savepoint per operation: a failure undoes only that operation.
        const outcome = await tx.transaction((savepoint) =>
          applyOperation(savepoint, operation, userId, requireEditor),
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

async function applyOperation(
  tx: Tx,
  { op, table, id, data }: Operation,
  userId: string,
  requireEditor: (spaceId: string) => Promise<void>,
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
      return 'applied'
    }

    if (!existing) return 'skipped'
    await requireEditor(existing.spaceId)

    if (op === 'DELETE') {
      await tx.delete(items).where(eq(items.id, id))
      return 'applied'
    }

    const patch = parse(itemPatch, data)
    const values = {
      type: patch.type,
      title: patch.title,
      body: patch.body,
      completedAt: patch.completed_at,
      completedBy: markedBy(patch.completed_at, userId),
      pinnedAt: patch.pinned_at,
      priority: patch.priority,
      status: patch.status,
      archivedAt: patch.archived_at,
      deletedAt: patch.deleted_at,
      deletedBy: markedBy(patch.deleted_at, userId),
      createdAt: patch.created_at,
      updatedAt: patch.updated_at,
    }
    if (!hasValues(values)) return 'skipped'
    await tx.update(items).set(values).where(eq(items.id, id))
    return 'applied'
  }

  const [existing] = await tx
    .select({ spaceId: entries.spaceId })
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
  return 'applied'
}
