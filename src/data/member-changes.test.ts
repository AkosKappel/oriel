import { describe, expect, it } from 'vitest'
import { announce, describeMemberChanges } from './member-changes'
import type { Item } from './schema'

const item = (fields: Partial<Item>): Item => ({
  id: 'id',
  space_id: 'home',
  created_by: 'me',
  type: 'task',
  title: 'Title',
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
  created_at: '2026-10-29T10:00:00.000Z',
  updated_at: '2026-10-29T10:00:00.000Z',
  ...fields,
})

const names: Record<string, string> = { anna: 'Anna', ben: 'Ben' }
const nameOf = (_item: Item, userId: string | null) =>
  userId ? names[userId] : undefined

describe('describeMemberChanges', () => {
  it("names what other members added and finished, and leaves out the user's own changes", () => {
    const tap = item({ id: 'tap', title: 'Fix the tap', created_by: 'me' })
    const before = new Map([['tap', tap]])
    const after = [
      { ...tap, completed_at: '2026-10-29T11:00:00.000Z', completed_by: 'ben' },
      item({ id: 'groceries', title: 'Groceries', created_by: 'anna' }),
      item({ id: 'mine', title: 'Mine', created_by: 'me' }),
    ]

    expect(describeMemberChanges(before, after, 'me', nameOf)).toEqual([
      'Ben finished Fix the tap',
      'Anna added Groceries',
    ])
  })

  it('stays quiet about unchanged, trashed and unknown items', () => {
    const vet = item({ id: 'vet', created_by: 'anna' })
    expect(
      describeMemberChanges(
        new Map([['vet', vet]]),
        [
          vet,
          item({ id: 'gone', created_by: 'anna', deleted_at: 'x' }),
          item({ id: 'stranger', created_by: 'someone' }),
        ],
        'me',
        nameOf,
      ),
    ).toEqual([])
  })
})

describe('announce', () => {
  it('reads a few changes and counts a batch', () => {
    expect(announce(['Anna added Milk', 'Ben finished Tap'])).toBe(
      'Anna added Milk. Ben finished Tap',
    )
    expect(announce(['a', 'b', 'c', 'd'])).toBe('4 changes from others')
  })
})
