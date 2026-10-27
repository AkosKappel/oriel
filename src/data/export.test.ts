import { describe, expect, it } from 'vitest'
import { toJson, toMarkdown } from './export'
import type { Entry, Item } from './schema'

const timestamp = '2026-10-01T00:00:00.000Z'

const item = (overrides: Partial<Item> & Pick<Item, 'id' | 'type'>): Item => ({
  space_id: null,
  created_by: null,
  title: overrides.id,
  body: '',
  completed_at: null,
  completed_by: null,
  pinned_at: null,
  priority: 0,
  archived_at: null,
  deleted_at: null,
  deleted_by: null,
  created_at: timestamp,
  updated_at: timestamp,
  ...overrides,
})

const entry = (overrides: Partial<Entry> & Pick<Entry, 'id'>): Entry => ({
  item_id: 'groceries',
  space_id: null,
  text: overrides.id,
  completed_at: null,
  completed_by: null,
  position: 0,
  created_at: timestamp,
  updated_at: timestamp,
  ...overrides,
})

const items = [
  item({ id: 'groceries', type: 'list', title: 'Groceries' }),
  item({
    id: 'vet',
    type: 'task',
    title: 'Call the vet',
    completed_at: timestamp,
  }),
  item({ id: 'idea', type: 'note', title: 'Idea', body: 'Paint the door\n' }),
  item({ id: 'old', type: 'note', title: 'Torn out', deleted_at: timestamp }),
]
const entries = [
  entry({ id: 'eggs', text: 'Eggs', position: 2 }),
  entry({ id: 'milk', text: 'Milk', position: 1, completed_at: timestamp }),
  entry({ id: 'bread', text: 'Bread', position: 3 }),
]

describe('toJson', () => {
  it('nests entries in list order under their item', () => {
    const data = JSON.parse(toJson(items, entries, new Date(timestamp)))
    expect(data).toMatchObject({
      app: 'oriel',
      version: 1,
      exported_at: timestamp,
    })
    const groceries = data.items.find((row: Item) => row.id === 'groceries')
    expect(groceries.entries.map((row: Entry) => row.text)).toEqual([
      'Eggs',
      'Bread',
      'Milk',
    ])
    expect(data.items.find((row: Item) => row.id === 'idea').entries).toEqual(
      [],
    )
  })
})

describe('toMarkdown', () => {
  it('writes a heading per item, text, and entries as checkboxes', () => {
    const markdown = toMarkdown(items, entries)
    expect(markdown).toContain(
      '## Groceries\n\n- [ ] Eggs\n- [ ] Bread\n- [x] Milk',
    )
    expect(markdown).toContain('## Idea\n\nPaint the door')
    expect(markdown).toContain('## [x] Call the vet')
    expect(markdown).not.toContain('Torn out')
    expect(markdown.endsWith('\n')).toBe(true)
  })
})
