import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PowerSyncDatabase } from '@powersync/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appSchema } from './schema'
import {
  entrySearchQuery,
  entrySummaryQuery,
  groupMatches,
  prepareSearch,
  queryWords,
  summariesByItem,
} from './search'
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
  directory = mkdtempSync(join(tmpdir(), 'oriel-search-'))
  database = openDatabase()
  await database.init()
  store = createStore(database)
  await Promise.all([store.items.preload(), store.entries.preload()])
  await prepareSearch(database)
})

afterEach(async () => {
  await database.close()
  rmSync(directory, { recursive: true, force: true })
})

async function search(query: string, db = database) {
  const { sql, params } = entrySearchQuery(queryWords(query))
  const matches = groupMatches(await db.getAll(sql, params))
  return Object.fromEntries(
    [...matches].map(([word, ids]) => [word, [...ids].sort()]),
  )
}

async function newList(title: string, texts: string[]) {
  const id = await store.createItem({ type: 'list', title })
  await store.addEntries(id, texts)
  return id
}

describe('entry search', () => {
  it('finds parts of words, ignoring case and accents', async () => {
    const groceries = await newList('Groceries', ['Oat milk', 'Kávé'])
    const packing = await newList('Packing', ['Buttermilk pancakes'])

    expect(await search('MILK')).toEqual({ milk: [groceries, packing].sort() })
    expect(await search('kave')).toEqual({ kave: [groceries] })
    expect(await search('cakes oat')).toEqual({
      cakes: [packing],
      oat: [groceries],
    })
    expect(await search('tea')).toEqual({})
  })

  it('compares words shorter than three characters in full', async () => {
    const groceries = await newList('Groceries', ['Eggs x2'])
    expect(await search('X2')).toEqual({ x2: [groceries] })
    expect(await search('%')).toEqual({})
  })

  it('takes quotes in the query as text', async () => {
    const quotes = await newList('Quotes', ['The "best" bread'])
    expect(await search('"best"')).toEqual({ '"best"': [quotes] })
  })

  it('follows edits, deletes and rows arriving from sync', async () => {
    const groceries = await newList('Groceries', ['Oat milk'])
    const [entry] = store.entries.toArray

    await store.updateEntryText(entry.id, 'Rice')
    expect(await search('milk')).toEqual({})
    expect(await search('rice')).toEqual({ rice: [groceries] })

    // Sync writes rows with REPLACE, which skips delete triggers.
    await database.execute(
      `REPLACE INTO ps_data__entries (id, data)
       SELECT id, json_set(data, '$.text', 'Bread') FROM ps_data__entries WHERE id = ?`,
      [entry.id],
    )
    expect(await search('rice')).toEqual({})
    expect(await search('bread')).toEqual({ bread: [groceries] })
    const { indexed } = await database.get<{ indexed: number }>(
      'SELECT count(*) AS indexed FROM entries_search',
    )
    expect(indexed).toBe(1)

    await store.deleteEntry(entry.id)
    expect(await search('bread')).toEqual({})
  })

  it('keeps working after signing out clears the device', async () => {
    await newList('Groceries', ['Oat milk'])
    await database.disconnectAndClear()
    expect(await search('milk')).toEqual({})

    const packing = await newList('Packing', ['Buttermilk'])
    expect(await search('milk')).toEqual({ milk: [packing] })
  })

  it('rebuilds an index that no longer matches the entries', async () => {
    const groceries = await newList('Groceries', ['Oat milk'])
    await database.execute('DELETE FROM entries_search')
    await database.close()

    database = openDatabase()
    await database.init()
    await prepareSearch(database)
    expect(await search('milk')).toEqual({ milk: [groceries] })
  })
})

describe('entry summaries', () => {
  it('counts entries and lists the first open ones in list order', async () => {
    const groceries = await newList('Groceries', [
      'Oat milk',
      'Eggs',
      'Bread',
      'Rice',
      'Tea',
    ])
    const empty = await store.createItem({ type: 'list', title: 'Empty' })
    const eggs = store.entries.toArray.find((entry) => entry.text === 'Eggs')
    await store.setEntryCompleted(eggs?.id ?? '', true)

    const summaries = summariesByItem(await database.getAll(entrySummaryQuery))
    expect(summaries.get(groceries)).toEqual({
      total: 5,
      open: 4,
      upNext: ['Oat milk', 'Bread', 'Rice'],
    })
    expect(summaries.get(empty)).toBeUndefined()
  })
})
