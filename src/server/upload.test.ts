import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Operation } from './upload'

// Needs the database (`docker compose up -d db` and `npm run db:migrate`).
describe.skipIf(!process.env.DATABASE_URL)('applyUpload', async () => {
  const { db } = await import('#/server/db')
  const { entries, items, spaceMember, user } = await import(
    '#/server/db/schema'
  )
  const { ensurePersonalSpace } = await import('#/server/spaces')
  const { applyUpload } = await import('#/server/upload')

  const users: string[] = []
  let alice: string
  let aliceSpace: string
  let bob: string
  let bobSpace: string

  async function newUser() {
    const id = `test-${crypto.randomUUID()}`
    await db
      .insert(user)
      .values({ id, name: 'Test', email: `${id}@example.com` })
    users.push(id)
    return { id, space: await ensurePersonalSpace(id) }
  }

  beforeAll(async () => {
    ;({ id: alice, space: aliceSpace } = await newUser())
    ;({ id: bob, space: bobSpace } = await newUser())
  })

  afterAll(async () => {
    // Spaces, memberships, items and entries go with the users (on delete cascade).
    for (const id of users) await db.delete(user).where(eq(user.id, id))
  })

  const now = '2026-10-27T12:00:00.000Z'
  const itemRow = (spaceId: string | null, overrides = {}) => ({
    space_id: spaceId,
    created_by: 'whoever-the-client-claims',
    type: 'task',
    title: 'Call the vet',
    body: 'Before Friday',
    priority: 3,
    created_at: now,
    updated_at: now,
    ...overrides,
  })
  const entryRow = (itemId: string, spaceId: string | null, text = 'Milk') => ({
    item_id: itemId,
    space_id: spaceId,
    text,
    position: 1,
    created_at: now,
    updated_at: now,
  })
  const put = (
    table: Operation['table'],
    data: Record<string, unknown>,
    id: string = crypto.randomUUID(),
  ): Operation => ({ op: 'PUT', table, id, data })

  const findItem = async (id: string) =>
    (await db.select().from(items).where(eq(items.id, id)))[0]

  it("writes an owner's items and entries, recording the real author", async () => {
    const list = put('items', itemRow(aliceSpace, { type: 'list' }))
    const result = await applyUpload(alice, [
      list,
      put('entries', entryRow(list.id, aliceSpace)),
    ])

    expect(result).toEqual({ applied: 2, skipped: 0, rejected: [] })
    expect(await findItem(list.id)).toMatchObject({
      spaceId: aliceSpace,
      createdBy: alice,
      priority: 3,
      createdAt: new Date(now),
    })
  })

  it('records the uploader as whoever checked a row, never the client value', async () => {
    const list = put('items', itemRow(aliceSpace, { type: 'list' }))
    const milk = put('entries', entryRow(list.id, aliceSpace))
    await applyUpload(alice, [list, milk])
    const checkedBy = async () =>
      (
        await db
          .select({ by: entries.completedBy })
          .from(entries)
          .where(eq(entries.id, milk.id))
      )[0].by

    await applyUpload(alice, [
      {
        op: 'PATCH',
        table: 'entries',
        id: milk.id,
        data: { completed_at: now, completed_by: bob },
      },
    ])
    expect(await checkedBy()).toBe(alice)

    await applyUpload(alice, [
      {
        op: 'PATCH',
        table: 'entries',
        id: milk.id,
        data: { text: 'Oat milk' },
      },
    ])
    expect(await checkedBy()).toBe(alice)

    await applyUpload(alice, [
      {
        op: 'PATCH',
        table: 'entries',
        id: milk.id,
        data: { completed_at: null },
      },
    ])
    expect(await checkedBy()).toBeNull()
  })

  it('skips rows made before the account existed, then accepts them once claimed', async () => {
    const id = crypto.randomUUID()
    const result = await applyUpload(alice, [
      put('items', itemRow(null), id),
      { op: 'PATCH', table: 'items', id, data: { title: 'Edited offline' } },
      // The claim on the device: delete, then the full row with its space.
      { op: 'DELETE', table: 'items', id },
      put('items', itemRow(aliceSpace, { title: 'Edited offline' }), id),
    ])

    expect(result).toEqual({ applied: 1, skipped: 3, rejected: [] })
    expect((await findItem(id)).title).toBe('Edited offline')
  })

  it('rejects writes to a space the user is not a member of, and writes nothing', async () => {
    const op = put('items', itemRow(bobSpace))
    const result = await applyUpload(alice, [op])

    expect(result.rejected).toEqual([
      { op: 'PUT', table: 'items', id: op.id, reason: 'forbidden' },
    ])
    expect(await findItem(op.id)).toBeUndefined()
  })

  it('archives and trashes items, recording the uploader as whoever deleted it', async () => {
    const note = put('items', itemRow(aliceSpace, { type: 'note' }))
    await applyUpload(alice, [note])
    const patch = (data: Record<string, unknown>): Operation => ({
      op: 'PATCH',
      table: 'items',
      id: note.id,
      data,
    })

    await applyUpload(alice, [patch({ archived_at: now })])
    expect(await findItem(note.id)).toMatchObject({
      archivedAt: new Date(now),
      deletedAt: null,
    })

    await applyUpload(alice, [patch({ deleted_at: now, deleted_by: bob })])
    expect(await findItem(note.id)).toMatchObject({
      deletedAt: new Date(now),
      deletedBy: alice,
    })

    await applyUpload(alice, [patch({ deleted_at: null })])
    expect(await findItem(note.id)).toMatchObject({
      deletedAt: null,
      deletedBy: null,
    })
  })

  it('stores a due day as a date and clears it with a patch', async () => {
    const task = put('items', itemRow(aliceSpace, { due_on: '2026-11-01' }))
    await applyUpload(alice, [task])
    expect(await findItem(task.id)).toMatchObject({ dueOn: '2026-11-01' })

    await applyUpload(alice, [
      { op: 'PATCH', table: 'items', id: task.id, data: { due_on: null } },
    ])
    expect(await findItem(task.id)).toMatchObject({ dueOn: null })
  })

  it('does not let a viewer move a shared item to the trash', async () => {
    const note = put('items', itemRow(bobSpace, { type: 'note' }))
    await applyUpload(bob, [note])
    await db.insert(spaceMember).values({
      spaceId: bobSpace,
      userId: alice,
      role: 'viewer',
      memberName: 'Alice',
    })

    const result = await applyUpload(alice, [
      { op: 'PATCH', table: 'items', id: note.id, data: { deleted_at: now } },
    ])

    expect(result.rejected[0]?.reason).toBe('forbidden')
    expect((await findItem(note.id)).deletedAt).toBeNull()
    await db
      .delete(spaceMember)
      .where(
        and(eq(spaceMember.spaceId, bobSpace), eq(spaceMember.userId, alice)),
      )
  })

  it('does not let a viewer change a shared space', async () => {
    await db.insert(spaceMember).values({
      spaceId: bobSpace,
      userId: alice,
      role: 'viewer',
      memberName: 'Alice',
    })
    const op = put('items', itemRow(bobSpace))

    const result = await applyUpload(alice, [op])

    expect(result.rejected[0]?.reason).toBe('forbidden')
    await db
      .delete(spaceMember)
      .where(
        and(eq(spaceMember.spaceId, bobSpace), eq(spaceMember.userId, alice)),
      )
  })

  it("does not let anyone take over another space's row by reusing its id", async () => {
    const bobsItem = put('items', itemRow(bobSpace))
    await applyUpload(bob, [bobsItem])

    const result = await applyUpload(alice, [
      put('items', itemRow(aliceSpace, { title: 'Mine now' }), bobsItem.id),
      { op: 'PATCH', table: 'items', id: bobsItem.id, data: { title: 'Mine' } },
      { op: 'DELETE', table: 'items', id: bobsItem.id },
    ])

    expect(result.rejected.map((rejection) => rejection.reason)).toEqual([
      'forbidden',
      'forbidden',
      'forbidden',
    ])
    expect(await findItem(bobsItem.id)).toMatchObject({
      spaceId: bobSpace,
      title: 'Call the vet',
    })
  })

  it('changes only the fields a PATCH carries', async () => {
    const op = put('items', itemRow(aliceSpace))
    await applyUpload(alice, [op])

    await applyUpload(alice, [
      {
        op: 'PATCH',
        table: 'items',
        id: op.id,
        data: { completed_at: '2026-10-28T09:00:00.000Z' },
      },
    ])

    expect(await findItem(op.id)).toMatchObject({
      title: 'Call the vet',
      body: 'Before Friday',
      priority: 3,
      pinnedAt: null,
      completedAt: new Date('2026-10-28T09:00:00.000Z'),
    })
  })

  it('rejects invalid rows without stopping the rest of the batch', async () => {
    const good = put('items', itemRow(aliceSpace))
    const list = put('items', itemRow(aliceSpace, { type: 'list' }))
    const result = await applyUpload(alice, [
      put('items', itemRow(aliceSpace, { title: '' })),
      put('items', itemRow(aliceSpace, { type: 'event' })),
      put('items', itemRow(aliceSpace, { priority: 9 })),
      put('items', itemRow(aliceSpace, { status: 'done' })),
      put('items', itemRow(aliceSpace, { due_on: '2026-13-01' })),
      list,
      // An entry must be in its list's space.
      put('entries', entryRow(list.id, bobSpace)),
      put('entries', entryRow(crypto.randomUUID(), aliceSpace)),
      good,
    ])

    expect(result.applied).toBe(2)
    expect(result.rejected.map((rejection) => rejection.reason)).toEqual([
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
    ])
    expect(await findItem(good.id)).toBeDefined()
  })

  it('deletes a list with its entries, and treats deleting a missing row as done', async () => {
    const list = put('items', itemRow(aliceSpace, { type: 'list' }))
    const entry = put('entries', entryRow(list.id, aliceSpace))
    await applyUpload(alice, [list, entry])

    const result = await applyUpload(alice, [
      { op: 'DELETE', table: 'items', id: list.id },
      { op: 'DELETE', table: 'items', id: crypto.randomUUID() },
    ])

    expect(result).toMatchObject({ applied: 1, skipped: 1 })
    expect(
      await db.select().from(entries).where(eq(entries.id, entry.id)),
    ).toEqual([])
  })
})
