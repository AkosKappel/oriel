import { describe, expect, it } from 'vitest'
import { type ActivityLine, describeActivity } from './activity'

let next = 0
const line = (overrides: Partial<ActivityLine>): ActivityLine => ({
  id: String(next++),
  action: 'added',
  at: '2026-10-30T10:00:00.000Z',
  userId: 'anna',
  memberName: 'Anna',
  itemId: 'groceries',
  itemTitle: 'Groceries',
  entryText: null,
  ...overrides,
})

const text = (lines: ActivityLine[]) =>
  describeActivity(lines).map(({ before, title, after }) =>
    [before, title, after].filter(Boolean).join(' '),
  )

describe('describeActivity', () => {
  it('joins a run of entry changes into one sentence, oldest first', () => {
    expect(
      text([
        line({ action: 'completed', entryText: 'Bread' }),
        line({ action: 'completed', entryText: 'Eggs' }),
        line({ action: 'completed', entryText: 'Milk' }),
        line({ entryText: 'Milk' }),
        line({}),
      ]),
    ).toEqual([
      'Anna checked Milk, Eggs and Bread in Groceries',
      'Anna added Milk to Groceries',
      'Anna added Groceries',
    ])
  })

  it('counts what does not fit and keeps different people apart', () => {
    const entries = ['A', 'B', 'C', 'D', 'E'].map((entryText) =>
      line({ entryText }),
    )
    expect(
      text([
        line({ userId: 'ben', memberName: 'Ben', action: 'trashed' }),
        ...entries,
        line({ userId: null, memberName: null, action: 'edited' }),
      ]),
    ).toEqual([
      'Ben moved Groceries to the trash',
      'Anna added E, D, C and 2 more to Groceries',
      'Someone who left edited Groceries',
    ])
  })

  it('words sentences in another language when asked', () => {
    const sentences = describeActivity(
      [
        line({ action: 'completed', entryText: 'Kenyér' }),
        line({ action: 'completed', entryText: 'Tej' }),
      ],
      'hu',
    )
    expect(sentences[0]).toMatchObject({
      before: 'Anna kipipált itt:',
      title: 'Groceries',
      after: '– Tej és Kenyér',
    })
  })
})
