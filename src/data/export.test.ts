import { describe, expect, it } from 'vitest'
import {
  itemToText,
  parseExport,
  toCalendar,
  toJson,
  toMarkdown,
} from './export'
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
  status: null,
  due_on: null,
  repeat: null,
  snoozed_until: null,
  assigned_to: null,
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

describe('itemToText', () => {
  it('writes one list as its title and entries in list order, ready to paste', () => {
    expect(itemToText(items[0], entries)).toBe(
      'Groceries\n\n- [ ] Eggs\n- [ ] Bread\n- [x] Milk',
    )
    expect(itemToText(items[2], [])).toBe('Idea\n\nPaint the door')
  })
})

describe('parseExport', () => {
  it('reads exports from before archive, trash, task status, due dates, repeats and snoozing', () => {
    const {
      status: _status,
      due_on: _due,
      repeat: _repeat,
      snoozed_until: _snoozed,
      archived_at: _archived,
      deleted_at: _deleted,
      deleted_by: _deletedBy,
      ...older
    } = item({ id: 'vet', type: 'task', title: 'Call the vet' })
    const { items: parsed, invalid } = parseExport(
      JSON.stringify({ app: 'oriel', version: 1, items: [older] }),
    )
    expect(invalid).toBe(0)
    expect(parsed[0]).toMatchObject({
      status: null,
      due_on: null,
      repeat: null,
      snoozed_until: null,
      archived_at: null,
      deleted_at: null,
    })
  })
})

describe('toCalendar', () => {
  const exportedAt = new Date('2026-10-30T09:15:00.000Z')

  it('turns open tasks with a due day into all-day events', () => {
    const ics = toCalendar(
      [
        item({
          id: 'vet',
          type: 'task',
          title: 'Call the vet; ask, then book',
          body: 'Before\nFriday',
          due_on: '2026-10-31',
        }),
        item({ id: 'no-day', type: 'task' }),
        item({
          id: 'done',
          type: 'task',
          due_on: '2026-11-02',
          completed_at: timestamp,
        }),
        item({
          id: 'trashed',
          type: 'task',
          due_on: '2026-11-02',
          deleted_at: timestamp,
        }),
        item({ id: 'note', type: 'note', due_on: '2026-11-02' }),
      ],
      exportedAt,
    )

    expect(ics.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Oriel//Tasks//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:vet@oriel',
      'DTSTAMP:20261030T091500Z',
      'DTSTART;VALUE=DATE:20261031',
      'DTEND;VALUE=DATE:20261101',
      'SUMMARY:Call the vet\\; ask\\, then book',
      'DESCRIPTION:Before\\nFriday',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ])
  })

  it('folds long lines at 75 bytes without splitting a character', () => {
    const title = 'Á'.repeat(100)
    const ics = toCalendar(
      [item({ id: 'long', type: 'task', title, due_on: '2026-10-31' })],
      exportedAt,
    )
    const lines = ics.split('\r\n')
    const start = lines.findIndex((line) => line.startsWith('SUMMARY:'))
    const folded = lines.slice(start, lines.indexOf('END:VEVENT'))

    expect(folded.length).toBeGreaterThan(1)
    for (const line of folded) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(folded.map((line, i) => (i ? line.slice(1) : line)).join('')).toBe(
      `SUMMARY:${title}`,
    )
  })
})
