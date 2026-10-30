import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Operation } from './upload'

// Needs the database (`docker compose up -d db` and `npm run db:migrate`).
describe.skipIf(!process.env.DATABASE_URL)('applyUpload', async () => {
  const { db } = await import('#/server/db')
  const { activity, entries, items, spaceMember, user } = await import(
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

  it('assigns a task only to a member of its space', async () => {
    const task = put('items', itemRow(aliceSpace, { assigned_to: bob }))
    const own = put('items', itemRow(aliceSpace, { assigned_to: alice }))
    const result = await applyUpload(alice, [task, own])
    // A full row keeps the task and drops an assignee from outside the space.
    expect(result.rejected).toEqual([])
    expect(await findItem(task.id)).toMatchObject({ assignedTo: null })
    expect(await findItem(own.id)).toMatchObject({ assignedTo: alice })
    const patch = await applyUpload(alice, [
      { op: 'PATCH', table: 'items', id: own.id, data: { assigned_to: bob } },
    ])
    expect(patch.rejected).toMatchObject([{ reason: 'invalid' }])

    await db.insert(spaceMember).values({
      spaceId: aliceSpace,
      userId: bob,
      role: 'viewer',
      memberName: 'Bob',
    })
    try {
      await applyUpload(alice, [
        { op: 'PATCH', table: 'items', id: own.id, data: { assigned_to: bob } },
      ])
      expect(await findItem(own.id)).toMatchObject({ assignedTo: bob })
    } finally {
      await db
        .delete(spaceMember)
        .where(
          and(eq(spaceMember.spaceId, aliceSpace), eq(spaceMember.userId, bob)),
        )
    }
  })

  it('stores a snooze day and refuses a time instead of a day', async () => {
    const note = put('items', itemRow(aliceSpace, { type: 'note' }))
    await applyUpload(alice, [note])
    const result = await applyUpload(alice, [
      {
        op: 'PATCH',
        table: 'items',
        id: note.id,
        data: { snoozed_until: '2026-11-02T08:00:00Z' },
      },
      {
        op: 'PATCH',
        table: 'items',
        id: note.id,
        data: { snoozed_until: '2026-11-02' },
      },
    ])
    expect(result.rejected).toMatchObject([{ reason: 'invalid' }])
    expect(await findItem(note.id)).toMatchObject({
      snoozedUntil: '2026-11-02',
    })
  })

  it('stores how a task repeats and refuses an unknown repeat', async () => {
    const task = put('items', itemRow(aliceSpace, { repeat: 'weekly' }))
    await applyUpload(alice, [task])
    expect(await findItem(task.id)).toMatchObject({ repeat: 'weekly' })

    const result = await applyUpload(alice, [
      { op: 'PATCH', table: 'items', id: task.id, data: { repeat: 'hourly' } },
      { op: 'PATCH', table: 'items', id: task.id, data: { repeat: null } },
    ])
    expect(result.rejected).toMatchObject([{ reason: 'invalid' }])
    expect(await findItem(task.id)).toMatchObject({ repeat: null })
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

  it('logs changes in a shared space, folding repeated edits, and nothing in a personal one', async () => {
    const { createSharedSpace, listActivity } = await import('#/server/sharing')
    const { space } = await import('#/server/db/schema')
    const home = await createSharedSpace(alice, 'Home')
    await db
      .insert(spaceMember)
      .values({ spaceId: home, userId: bob, role: 'editor', memberName: 'Bob' })
    try {
      const list = put('items', itemRow(home, { type: 'list' }))
      const milk = put('entries', entryRow(list.id, home))
      await applyUpload(alice, [list, milk])
      const patch = (
        table: Operation['table'],
        id: string,
        data: Record<string, unknown>,
      ): Operation => ({ op: 'PATCH', table, id, data })
      await applyUpload(bob, [
        patch('entries', milk.id, { completed_at: now }),
        patch('items', list.id, { body: 'For Saturday' }),
        patch('items', list.id, { body: 'For Saturday, early' }),
        patch('items', list.id, { pinned_at: now }),
      ])

      const lines = await listActivity(bob, home)
      expect(
        lines.map(({ action, memberName, entryText }) => ({
          action,
          memberName,
          entryText,
        })),
      ).toEqual([
        { action: 'edited', memberName: 'Bob', entryText: null },
        { action: 'completed', memberName: 'Bob', entryText: 'Milk' },
        { action: 'added', memberName: 'Test', entryText: 'Milk' },
        { action: 'added', memberName: 'Test', entryText: null },
      ])
      expect(lines[0].itemTitle).toBe('Call the vet')

      // Nothing kept once the item is gone, and only members may read the log.
      await applyUpload(alice, [{ op: 'DELETE', table: 'items', id: list.id }])
      expect(await listActivity(alice, home)).toEqual([])
      const { id: carol } = await newUser()
      await expect(listActivity(carol, home)).rejects.toThrow()

      const own = put('items', itemRow(aliceSpace))
      await applyUpload(alice, [own])
      expect(
        await db.select().from(activity).where(eq(activity.itemId, own.id)),
      ).toEqual([])
    } finally {
      await db.delete(space).where(eq(space.id, home))
    }
  })

  it('keeps one version of the text per editing session, for members only', async () => {
    const { listVersions } = await import('#/server/history')
    const note = put(
      'items',
      itemRow(aliceSpace, { type: 'note', body: 'Draft' }),
    )
    const edit = (body: string): Operation => ({
      op: 'PATCH',
      table: 'items',
      id: note.id,
      data: { body },
    })
    await applyUpload(alice, [
      note,
      edit('Draft, longer'),
      edit('Draft, longer'),
    ])
    await db.insert(spaceMember).values({
      spaceId: aliceSpace,
      userId: bob,
      role: 'editor',
      memberName: 'Bob',
    })
    try {
      await applyUpload(bob, [edit('Edited by Bob')])
      const versions = await listVersions(alice, note.id)
      expect(versions.map(({ body, savedBy }) => ({ body, savedBy }))).toEqual([
        { body: 'Edited by Bob', savedBy: bob },
        { body: 'Draft, longer', savedBy: alice },
      ])
    } finally {
      await db
        .delete(spaceMember)
        .where(
          and(eq(spaceMember.spaceId, aliceSpace), eq(spaceMember.userId, bob)),
        )
    }
    await expect(listVersions(bob, note.id)).rejects.toThrow()
  })

  it('moves an item without deleting it, so a refused move loses nothing', async () => {
    const { createSharedSpace } = await import('#/server/sharing')
    const { activity, noteVersion, space } = await import('#/server/db/schema')
    const home = await createSharedSpace(alice, 'Home')
    const work = await createSharedSpace(alice, 'Work')
    const versions = async (id: string) =>
      (await db.select().from(noteVersion).where(eq(noteVersion.itemId, id)))
        .length
    const logged = async (id: string, spaceId: string) =>
      (
        await db
          .select()
          .from(activity)
          .where(and(eq(activity.itemId, id), eq(activity.spaceId, spaceId)))
      ).length
    const move = (id: string, row: Record<string, unknown>): Operation[] => [
      { op: 'DELETE', table: 'items', id },
      { op: 'PUT', table: 'items', id, data: row },
    ]
    try {
      // Out of the personal space (sharing one note): its history comes along.
      const note = put(
        'items',
        itemRow(aliceSpace, { type: 'note', body: 'v1' }),
      )
      await applyUpload(alice, [note])
      // An earlier editing session, so the moved text is a version of its own.
      await db
        .update(noteVersion)
        .set({ savedAt: new Date(Date.now() - 3_600_000) })
        .where(eq(noteVersion.itemId, note.id))
      const moved = await applyUpload(
        alice,
        move(note.id, itemRow(home, { type: 'note', body: 'v2' })),
      )
      expect(moved.rejected).toEqual([])
      expect(await findItem(note.id)).toMatchObject({ spaceId: home })
      expect(await versions(note.id)).toBe(2)

      // From one shared space to another: the old space's log and texts stay behind.
      await applyUpload(alice, [
        {
          op: 'PATCH',
          table: 'items',
          id: note.id,
          data: { title: 'Renamed' },
        },
      ])
      expect(await logged(note.id, home)).toBeGreaterThan(0)
      await applyUpload(
        alice,
        move(note.id, itemRow(work, { type: 'note', body: 'v2' })),
      )
      expect(await logged(note.id, home)).toBe(0)
      // History starts over with the current text.
      expect(await versions(note.id)).toBe(1)

      // A move the server refuses (no edit rights in the target) leaves the item where it was.
      const refused = await applyUpload(alice, move(note.id, itemRow(bobSpace)))
      expect(refused.rejected).toMatchObject([
        { op: 'PUT', reason: 'forbidden' },
      ])
      expect(await findItem(note.id)).toMatchObject({ spaceId: work })
    } finally {
      await db.delete(space).where(eq(space.id, home))
      await db.delete(space).where(eq(space.id, work))
    }
  })
})
