import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PowerSyncDatabase } from '@powersync/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appSchema } from './schema'
import { createStore, type Store } from './store'

let directory: string
let database: InstanceType<typeof PowerSyncDatabase>
let store: Store

function openDatabase() {
  return new PowerSyncDatabase({
    schema: appSchema,
    database: { dbFilename: 'test.sqlite', dbLocation: directory },
  })
}

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'oriel-'))
  database = openDatabase()
  await database.init()
  store = createStore(database)
  await Promise.all([store.items.preload(), store.entries.preload()])
})

afterEach(async () => {
  await database.close()
  rmSync(directory, { recursive: true, force: true })
})

const countRows = async (table: 'items' | 'entries') =>
  (await database.get<{ n: number }>(`SELECT count(*) AS n FROM ${table}`)).n

describe('items', () => {
  it('stores a new item with trimmed text', async () => {
    const id = await store.createItem({
      type: 'task',
      title: '  Call the vet ',
    })

    const row = await database.get('SELECT * FROM items WHERE id = ?', [id])
    expect(row).toMatchObject({
      type: 'task',
      title: 'Call the vet',
      body: '',
      completed_at: null,
    })
    expect(store.items.get(id)?.title).toBe('Call the vet')
  })

  it('rejects an empty title or an unknown type without writing', async () => {
    await expect(
      store.createItem({ type: 'note', title: '   ' }),
    ).rejects.toThrow()
    await expect(
      // @ts-expect-error an invalid type is the point of this test
      store.createItem({ type: 'event', title: 'Party' }),
    ).rejects.toThrow()
    expect(await countRows('items')).toBe(0)
  })

  it('updates text and completion and bumps updated_at', async () => {
    const id = await store.createItem({ type: 'task', title: 'Draft' })
    const created = store.items.get(id)?.updated_at

    await new Promise((resolve) => setTimeout(resolve, 5))
    await store.updateItem(id, { title: 'Final', body: 'Details' })
    await store.setItemCompleted(id, true)

    const item = store.items.get(id)
    expect(item).toMatchObject({ title: 'Final', body: 'Details' })
    expect(item?.completed_at).not.toBeNull()
    expect(item?.updated_at).not.toBe(created)

    await store.setItemCompleted(id, false)
    expect(store.items.get(id)?.completed_at).toBeNull()
  })

  it('deletes an item together with its entries only', async () => {
    const list = await store.createItem({ type: 'list', title: 'Groceries' })
    const other = await store.createItem({ type: 'list', title: 'Hardware' })
    await store.addEntry(list, 'Milk')
    await store.addEntry(list, 'Bread')
    const kept = await store.addEntry(other, 'Screws')

    await store.deleteItem(list)

    expect(await countRows('items')).toBe(1)
    expect(store.entries.toArray.map((entry) => entry.id)).toEqual([kept])
    expect(await countRows('entries')).toBe(1)
  })
})

describe('organizing items', () => {
  it('pins and unpins an item', async () => {
    const id = await store.createItem({ type: 'note', title: 'Gate code' })
    expect(store.items.get(id)?.pinned_at).toBeNull()

    await store.setItemPinned(id, true)
    expect(store.items.get(id)?.pinned_at).not.toBeNull()

    await store.setItemPinned(id, false)
    expect(store.items.get(id)?.pinned_at).toBeNull()
  })

  it('sets a priority and rejects values outside the scale', async () => {
    const id = await store.createItem({ type: 'task', title: 'Pay rent' })
    expect(store.items.get(id)?.priority).toBe(0)

    await store.setItemPriority(id, 3)
    expect(await database.get('SELECT priority FROM items')).toEqual({
      priority: 3,
    })

    // @ts-expect-error an out-of-range priority is the point of this test
    await expect(store.setItemPriority(id, 5)).rejects.toThrow()
  })

  it('reads rows without a priority as no priority', async () => {
    await database.execute(
      `INSERT INTO items (id, type, title, body, created_at, updated_at)
       VALUES ('legacy', 'task', 'Old', '', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')`,
    )
    await vi.waitFor(() => expect(store.items.get('legacy')?.priority).toBe(0))
  })
})

describe('undo', () => {
  it('restores a deleted list with its entries and ids', async () => {
    const id = await store.createItem({
      type: 'list',
      title: 'Groceries',
      entries: ['Milk', 'Eggs'],
    })
    const entryIds = store.entries.toArray.map((entry) => entry.id).sort()

    const snapshot = await store.deleteItem(id)
    expect(await countRows('items')).toBe(0)

    await store.restore(snapshot)
    expect(store.items.get(id)?.title).toBe('Groceries')
    expect(store.entries.toArray.map((entry) => entry.id).sort()).toEqual(
      entryIds,
    )
    expect(await countRows('entries')).toBe(2)
  })

  it('clears only the checked entries of one list and can bring them back', async () => {
    const list = await store.createItem({
      type: 'list',
      title: 'Groceries',
      entries: ['Milk', 'Eggs'],
    })
    const other = await store.createItem({
      type: 'list',
      title: 'Hardware',
      entries: ['Screws'],
    })
    const [milk] = store.entries.toArray.filter(
      (entry) => entry.text === 'Milk',
    )
    const [screws] = store.entries.toArray.filter(
      (entry) => entry.item_id === other,
    )
    await store.setEntryCompleted(milk.id, true)
    await store.setEntryCompleted(screws.id, true)

    const snapshot = await store.clearCompletedEntries(list)
    expect(snapshot.entries.map((entry) => entry.text)).toEqual(['Milk'])
    expect(await countRows('entries')).toBe(2)

    await store.restore(snapshot)
    expect(store.entries.get(milk.id)?.completed_at).not.toBeNull()
  })
})

describe('ownership', () => {
  const owner = { userId: 'user-1', spaceId: 'space-1' }

  it('keeps items on the device only, with no space, until there is an owner', async () => {
    const id = await store.createItem({
      type: 'list',
      title: 'Groceries',
      entries: ['Milk'],
    })
    expect(store.items.get(id)).toMatchObject({
      space_id: null,
      created_by: null,
    })
    expect(store.entries.toArray[0].space_id).toBeNull()
  })

  it("puts new items and their entries in the owner's space", async () => {
    store.setOwner(owner)
    const id = await store.createItem({
      type: 'list',
      title: 'Groceries',
      entries: ['Milk'],
    })
    await store.addEntry(id, 'Eggs')

    expect(store.items.get(id)).toMatchObject({
      space_id: 'space-1',
      created_by: 'user-1',
    })
    expect(store.entries.toArray.map((entry) => entry.space_id)).toEqual([
      'space-1',
      'space-1',
    ])
  })

  it('claims everything made without an account, entries included', async () => {
    const list = await store.createItem({
      type: 'list',
      title: 'Groceries',
      entries: ['Milk', 'Eggs'],
    })
    const note = await store.createItem({ type: 'note', title: 'Gate code' })

    expect(await store.claimLocalData(owner)).toBe(2)

    const rows = await database.getAll<{ id: string; space_id: string }>(
      'SELECT id, space_id, created_by FROM items ORDER BY title',
    )
    expect(rows).toEqual([
      { id: note, space_id: 'space-1', created_by: 'user-1' },
      { id: list, space_id: 'space-1', created_by: 'user-1' },
    ])
    expect(
      await database.getAll('SELECT DISTINCT space_id FROM entries'),
    ).toEqual([{ space_id: 'space-1' }])
  })

  it('leaves rows that already belong to a space alone, so claiming twice is harmless', async () => {
    store.setOwner({ userId: 'user-2', spaceId: 'shared' })
    const shared = await store.createItem({ type: 'note', title: 'Shared' })
    store.setOwner(null)
    await store.createItem({ type: 'note', title: 'Local' })

    expect(await store.claimLocalData(owner)).toBe(1)
    expect(await store.claimLocalData(owner)).toBe(0)
    expect(store.items.get(shared)?.space_id).toBe('shared')
  })

  it('queues the claim as full rows, so the server can create them', async () => {
    const id = await store.createItem({ type: 'note', title: 'Idea' })
    await store.claimLocalData(owner)

    const batch = await database.getCrudBatch(10)
    const claimOps = batch?.crud.slice(-2)
    expect(claimOps?.map((entry) => [entry.op, entry.id])).toEqual([
      ['DELETE', id],
      ['PUT', id],
    ])
    expect(claimOps?.[1].opData).toMatchObject({
      space_id: 'space-1',
      created_by: 'user-1',
      title: 'Idea',
      type: 'note',
    })
  })
})

describe('spaces', () => {
  const owner = { userId: 'user-1', spaceId: 'personal' }

  it('captures into a chosen space instead of the personal one', async () => {
    store.setOwner(owner)
    const id = await store.createItem(
      { type: 'list', title: 'Party', entries: ['Cake'] },
      { spaceId: 'family' },
    )
    expect(store.items.get(id)?.space_id).toBe('family')
    expect(store.entries.toArray[0].space_id).toBe('family')
  })

  it('moves an item with its entries, uploaded as a delete and a full create', async () => {
    store.setOwner(owner)
    const id = await store.createItem({
      type: 'list',
      title: 'Groceries',
      entries: ['Milk', 'Eggs'],
    })
    const queuedBefore = (await database.getCrudBatch(100))?.crud.length ?? 0

    await store.moveItem(id, 'family')

    expect(
      await database.getAll('SELECT DISTINCT space_id FROM items'),
    ).toEqual([{ space_id: 'family' }])
    expect(
      await database.getAll('SELECT DISTINCT space_id FROM entries'),
    ).toEqual([{ space_id: 'family' }])
    const moveOps = (await database.getCrudBatch(100))?.crud.slice(queuedBefore)
    expect(moveOps?.map((entry) => `${entry.table} ${entry.op}`)).toEqual([
      'items DELETE',
      'items PUT',
      'entries DELETE',
      'entries PUT',
      'entries DELETE',
      'entries PUT',
    ])
  })
})

describe('creating a list with entries', () => {
  it('stores the list and its entries together', async () => {
    const id = await store.createItem({
      type: 'list',
      title: 'Groceries',
      entries: ['Milk', ' Eggs '],
    })

    const rows = await database.getAll<{ text: string }>(
      'SELECT text FROM entries WHERE item_id = ? ORDER BY text',
      [id],
    )
    expect(rows.map((row) => row.text)).toEqual(['Eggs', 'Milk'])
  })

  it('keeps entries in the order they were written', async () => {
    const id = await store.createItem({
      type: 'list',
      title: 'Groceries',
      entries: ['milk', 'eggs', 'bread', 'coffee'],
    })
    await store.addEntries(id, ['butter', 'jam'])

    const rows = await database.getAll<{ text: string }>(
      'SELECT text FROM entries WHERE item_id = ? ORDER BY position',
      [id],
    )
    expect(rows.map((row) => row.text)).toEqual([
      'milk',
      'eggs',
      'bread',
      'coffee',
      'butter',
      'jam',
    ])
  })

  it('writes nothing when one entry is invalid', async () => {
    await expect(
      store.createItem({
        type: 'list',
        title: 'Groceries',
        entries: ['Milk', ''],
      }),
    ).rejects.toThrow()
    expect(await countRows('items')).toBe(0)
    expect(await countRows('entries')).toBe(0)
  })

  it('rejects entries on anything but a list', async () => {
    await expect(
      store.createItem({ type: 'note', title: 'Idea', entries: ['One'] }),
    ).rejects.toThrow('Only lists have entries')
  })
})

describe('entries', () => {
  it('adds, edits, completes and deletes entries', async () => {
    const list = await store.createItem({ type: 'list', title: 'Groceries' })
    const id = await store.addEntry(list, ' Milk ')

    await store.updateEntryText(id, 'Oat milk')
    await store.setEntryCompleted(id, true)
    expect(store.entries.get(id)).toMatchObject({
      item_id: list,
      text: 'Oat milk',
    })
    expect(store.entries.get(id)?.completed_at).not.toBeNull()

    await store.deleteEntry(id)
    expect(await countRows('entries')).toBe(0)
  })

  it('rejects empty entry text', async () => {
    const list = await store.createItem({ type: 'list', title: 'Groceries' })
    await expect(store.addEntry(list, '  ')).rejects.toThrow()
  })
})

describe('persistence', () => {
  it('keeps data after the database is closed and opened again', async () => {
    const id = await store.createItem({
      type: 'note',
      title: 'Gate code',
      body: '4821',
    })
    await database.close()

    database = openDatabase()
    await database.init()
    store = createStore(database)
    await store.items.preload()

    expect(store.items.get(id)).toMatchObject({
      title: 'Gate code',
      body: '4821',
    })
  })

  it('queues every write for upload to the server', async () => {
    await store.createItem({ type: 'note', title: 'Idea' })
    const batch = await database.getCrudBatch()
    expect(batch?.crud.map((entry) => entry.table)).toEqual(['items'])
  })
})
