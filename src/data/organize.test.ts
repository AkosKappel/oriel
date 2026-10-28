import { describe, expect, it } from 'vitest'
import {
  countEntries,
  itemsInView,
  organizeItems,
  searchItems,
  sortEntries,
  suggestEntries,
  withStatus,
} from './organize'
import type { Entry, Item } from './schema'

function item(overrides: Partial<Item> & Pick<Item, 'id'>): Item {
  return {
    space_id: null,
    created_by: null,
    type: 'task',
    title: overrides.id,
    body: '',
    completed_at: null,
    completed_by: null,
    pinned_at: null,
    priority: 0,
    status: null,
    archived_at: null,
    deleted_at: null,
    deleted_by: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

function entry(overrides: Partial<Entry> & Pick<Entry, 'id'>): Entry {
  return {
    item_id: 'list',
    space_id: null,
    text: overrides.id,
    completed_at: null,
    completed_by: null,
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

const ids = (items: { id: string }[]) => items.map(({ id }) => id)

describe('organizeItems', () => {
  const items = [
    item({ id: 'old', created_at: '2026-10-01T00:00:00Z' }),
    item({ id: 'new', created_at: '2026-10-03T00:00:00Z' }),
    item({ id: 'urgent', priority: 3, created_at: '2026-09-01T00:00:00Z' }),
    item({ id: 'low', priority: 1, created_at: '2026-10-05T00:00:00Z' }),
    item({
      id: 'pinned-early',
      type: 'note',
      pinned_at: '2026-10-02T00:00:00Z',
    }),
    item({
      id: 'pinned-late',
      type: 'list',
      pinned_at: '2026-10-04T00:00:00Z',
    }),
    item({ id: 'done-early', completed_at: '2026-10-02T00:00:00Z' }),
    item({
      id: 'done-late',
      completed_at: '2026-10-04T00:00:00Z',
      pinned_at: '2026-10-04T00:00:00Z',
    }),
  ]

  it('puts pinned items first, newest pin on top', () => {
    expect(ids(organizeItems(items).pinned)).toEqual([
      'pinned-late',
      'pinned-early',
    ])
  })

  it('sorts open items by priority, then newest first', () => {
    expect(ids(organizeItems(items).open)).toEqual([
      'urgent',
      'low',
      'new',
      'old',
    ])
  })

  it('moves completed tasks to their own section, latest first, even when pinned', () => {
    expect(ids(organizeItems(items).completed)).toEqual([
      'done-late',
      'done-early',
    ])
  })

  it('keeps open tasks in one status, or everything without one', () => {
    const tasks = [
      item({ id: 'doing', status: 'in_progress' }),
      item({ id: 'waiting', status: 'waiting' }),
      item({ id: 'to-do' }),
      item({
        id: 'done',
        status: 'in_progress',
        completed_at: '2026-10-02T00:00:00Z',
      }),
      item({ id: 'note', type: 'note', status: 'in_progress' }),
    ]
    expect(ids(withStatus(tasks, 'in_progress'))).toEqual(['doing'])
    expect(ids(withStatus(tasks, 'waiting'))).toEqual(['waiting'])
    expect(withStatus(tasks)).toBe(tasks)
  })

  it('filters by type', () => {
    const { pinned, open, completed } = organizeItems(items, 'note')
    expect(ids(pinned)).toEqual(['pinned-early'])
    expect(open).toEqual([])
    expect(completed).toEqual([])
  })
})

describe('sortEntries', () => {
  it('lists open entries by position, checked ones last in the order checked', () => {
    const entries = [
      entry({ id: 'b', position: 2, created_at: '2026-10-01T00:00:00Z' }),
      entry({ id: 'checked-late', completed_at: '2026-10-09T00:00:00Z' }),
      entry({ id: 'a', position: 1, created_at: '2026-10-02T00:00:00Z' }),
      entry({ id: 'checked-early', completed_at: '2026-10-08T00:00:00Z' }),
    ]
    expect(ids(sortEntries(entries))).toEqual([
      'a',
      'b',
      'checked-early',
      'checked-late',
    ])
  })
})

describe('countEntries', () => {
  it('counts all and open entries per item and previews the next open ones', () => {
    const counts = countEntries([
      entry({ id: '1', item_id: 'groceries', text: 'eggs', position: 2 }),
      entry({
        id: '2',
        item_id: 'groceries',
        text: 'milk',
        completed_at: '2026-10-02T00:00:00Z',
      }),
      entry({ id: '3', item_id: 'groceries', text: 'bread', position: 1 }),
      entry({ id: '4', item_id: 'groceries', text: 'tea', position: 3 }),
      entry({ id: '5', item_id: 'groceries', text: 'jam', position: 4 }),
      entry({ id: '6', item_id: 'packing' }),
    ])
    expect(counts.get('groceries')).toEqual({
      total: 5,
      open: 4,
      upNext: ['bread', 'eggs', 'tea'],
    })
    expect(counts.get('packing')).toMatchObject({ total: 1, open: 1 })
    expect(counts.get('missing')).toBeUndefined()
  })
})

describe('searchItems', () => {
  const items = [
    item({ id: 'vet', title: 'Call the vet', body: 'About Bodri' }),
    item({ id: 'list', type: 'list', title: 'Groceries' }),
    item({ id: 'cafe', type: 'note', title: 'Café on Main Street' }),
  ]
  const entries = [entry({ id: 'oat', text: 'Oat milk' })]

  it('keeps everything for an empty query', () => {
    expect(ids(searchItems(items, entries, '  '))).toEqual([
      'vet',
      'list',
      'cafe',
    ])
  })

  it('matches titles, text and list entries, ignoring case and accents', () => {
    expect(ids(searchItems(items, entries, 'bodri'))).toEqual(['vet'])
    expect(ids(searchItems(items, entries, 'MILK'))).toEqual(['list'])
    expect(ids(searchItems(items, entries, 'cafe'))).toEqual(['cafe'])
  })

  it('needs every word, in any order', () => {
    expect(ids(searchItems(items, entries, 'street main'))).toEqual(['cafe'])
    expect(ids(searchItems(items, entries, 'main vet'))).toEqual([])
  })
})

describe('itemsInView', () => {
  const items = [
    item({ id: 'open' }),
    item({ id: 'archived', archived_at: '2026-10-02T00:00:00Z' }),
    item({ id: 'trashed', deleted_at: '2026-10-02T00:00:00Z' }),
    item({
      id: 'archived-then-trashed',
      archived_at: '2026-10-01T00:00:00Z',
      deleted_at: '2026-10-03T00:00:00Z',
    }),
  ]

  it('keeps archived and trashed items off home', () => {
    expect(ids(itemsInView(items))).toEqual(['open'])
  })

  it('shows the archive without what went to the trash', () => {
    expect(ids(itemsInView(items, 'archive'))).toEqual(['archived'])
  })

  it('shows everything trashed, most recent first', () => {
    expect(ids(itemsInView(items, 'trash'))).toEqual([
      'archived-then-trashed',
      'trashed',
    ])
  })
})

describe('suggestEntries', () => {
  const at = (day: number) =>
    `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`
  const entries = [
    entry({ id: 'a', item_id: 'week1', text: 'oat milk', created_at: at(1) }),
    entry({ id: 'b', item_id: 'week2', text: 'Oat milk', created_at: at(8) }),
    entry({ id: 'c', item_id: 'week2', text: 'Eggs', created_at: at(8) }),
    entry({ id: 'd', item_id: 'week3', text: 'Bread', created_at: at(15) }),
    entry({ id: 'e', item_id: 'now', text: 'Eggs', created_at: at(20) }),
    entry({
      id: 'f',
      item_id: 'now',
      text: 'Butter',
      created_at: at(20),
      completed_at: at(21),
    }),
  ]

  it('offers what was used before, most used first, in its latest spelling', () => {
    expect(suggestEntries(entries, 'other')).toEqual([
      'Eggs',
      'Oat milk',
      'Butter',
      'Bread',
    ])
  })

  it('leaves out what the list already has open, but not what is checked', () => {
    expect(suggestEntries(entries, 'now')).toEqual([
      'Oat milk',
      'Butter',
      'Bread',
    ])
  })
})
