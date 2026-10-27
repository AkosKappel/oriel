import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PowerSyncDatabase } from '@powersync/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
