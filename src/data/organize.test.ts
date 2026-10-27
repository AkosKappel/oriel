import { describe, expect, it } from 'vitest'
import { countEntries, organizeItems, sortEntries } from './organize'
import type { Entry, Item } from './schema'

function item(overrides: Partial<Item> & Pick<Item, 'id'>): Item {
  return {
    type: 'task',
    title: overrides.id,
    body: '',
    completed_at: null,
    pinned_at: null,
    priority: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

function entry(overrides: Partial<Entry> & Pick<Entry, 'id'>): Entry {
  return {
    item_id: 'list',
    text: overrides.id,
    completed_at: null,
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
  it('counts all and open entries per item', () => {
    const counts = countEntries([
      entry({ id: '1', item_id: 'groceries' }),
      entry({
        id: '2',
        item_id: 'groceries',
        completed_at: '2026-10-02T00:00:00Z',
      }),
      entry({ id: '3', item_id: 'packing' }),
    ])
    expect(counts.get('groceries')).toEqual({ total: 2, open: 1 })
    expect(counts.get('packing')).toEqual({ total: 1, open: 1 })
    expect(counts.get('missing')).toBeUndefined()
  })
})
