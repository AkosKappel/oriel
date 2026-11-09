import { describe, expect, it } from 'vitest'
import { parseAppend, parseCapture, readDueDay, readEntryLine } from './capture'
import type { Item } from './schema'

describe('parseCapture', () => {
  it('returns null for blank text', () => {
    expect(parseCapture(' \n  \n', 'note')).toBeNull()
  })

  it('uses the first line as the title and the rest as a note body', () => {
    expect(parseCapture('  Gate code \n4821\n\nRing twice', 'note')).toEqual({
      type: 'note',
      title: 'Gate code',
      body: '4821\n\nRing twice',
      entries: [],
    })
  })

  it('keeps extra lines of a task as its details', () => {
    expect(parseCapture('Call the vet\nAsk about the vaccine', 'task')).toEqual(
      {
        type: 'task',
        title: 'Call the vet',
        body: 'Ask about the vaccine',
        entries: [],
      },
    )
  })

  it('turns the lines of a list into entries without bullets or checkboxes', () => {
    const text =
      'Groceries\n- milk\n* eggs\n• bread\n[ ] butter\n[] jam\n1. tea\n2) rice\n\n'
    expect(parseCapture(text, 'list')).toEqual({
      type: 'list',
      title: 'Groceries',
      body: '',
      entries: ['milk', 'eggs', 'bread', 'butter', 'jam', 'tea', 'rice'],
    })
  })

  it('strips a bullet together with a Markdown checkbox, and keeps decimal quantities', () => {
    expect(
      parseCapture('Baking\n- [ ] sugar\n* [x] eggs\n2.5 kg flour', 'list'),
    ).toMatchObject({ entries: ['sugar', 'eggs', '2.5 kg flour'] })
  })

  it('reads a one-line list as "title: entry, entry"', () => {
    expect(
      parseCapture('Groceries: milk, eggs , ,bread', 'list'),
    ).toMatchObject({
      title: 'Groceries',
      entries: ['milk', 'eggs', 'bread'],
    })
  })

  it('does not split times or a colon in the middle of a word', () => {
    expect(parseCapture('Standup at 10:30', 'list')).toMatchObject({
      title: 'Standup at 10:30',
      entries: [],
    })
  })

  it('applies the one-line list syntax to lists only', () => {
    expect(parseCapture('Note to self: buy milk', 'note')).toMatchObject({
      title: 'Note to self: buy milk',
      body: '',
    })
  })

  it('gives a pasted paragraph a short title and keeps all of it in the body', () => {
    const paragraph = `${'word '.repeat(50)}end`
    const draft = parseCapture(`${paragraph}\nSecond line`, 'note')
    expect(draft?.title).toBe(`${'word '.repeat(11)}word…`)
    expect(draft?.body).toBe(`${paragraph}\nSecond line`)
  })

  it('keeps a long first line as the title of a task, so validation can flag it', () => {
    const line = 'x'.repeat(250)
    expect(parseCapture(line, 'task')?.title).toBe(line)
  })

  it('keeps a list title made only of a bullet line', () => {
    expect(parseCapture('- milk\n- eggs', 'list')).toMatchObject({
      title: 'milk',
      entries: ['eggs'],
    })
  })
})

describe('readEntryLine', () => {
  it('tells checked Markdown lines from open ones', () => {
    expect(readEntryLine('- [x] milk')).toEqual({ text: 'milk', checked: true })
    expect(readEntryLine('[X] eggs')).toEqual({ text: 'eggs', checked: true })
    expect(readEntryLine('- [ ] bread')).toEqual({
      text: 'bread',
      checked: false,
    })
    expect(readEntryLine('1. tea')).toEqual({ text: 'tea', checked: false })
  })
})

describe('parseAppend', () => {
  const list = (title: string) => ({ id: title, title }) as Item
  const lists = [list('Weekly'), list('Weekly shop'), list('Kávé')]

  it('ignores text without a leading plus', () => {
    expect(parseAppend('Groceries: milk', lists)).toBeNull()
  })

  it('adds comma-separated entries to the longest matching list title', () => {
    expect(parseAppend('+weekly shop eggs, oat milk ,', lists)).toEqual({
      list: lists[1],
      entries: ['eggs', 'oat milk'],
    })
    expect(parseAppend('+Weekly: eggs', lists)).toEqual({
      list: lists[0],
      entries: ['eggs'],
    })
  })

  it('ignores accents in the name and reads entries from further lines', () => {
    expect(parseAppend('+kave\n- beans\n2.5 kg sugar', lists)).toEqual({
      list: lists[2],
      entries: ['beans', '2.5 kg sugar'],
    })
  })

  it('only matches whole words and reports an unknown list by name', () => {
    expect(parseAppend('+Weeklyish eggs', lists)).toEqual({
      list: null,
      name: 'Weeklyish eggs',
    })
  })

  it('finds the list before any entries are typed', () => {
    expect(parseAppend('+Weekly shop', lists)).toEqual({
      list: lists[1],
      entries: [],
    })
  })
})

describe('readDueDay', () => {
  // Monday 9 November 2026.
  const today = '2026-11-09'

  it('reads today, tomorrow and the day after from the end of a task', () => {
    expect(readDueDay('Call the dentist tomorrow', today, 'en')).toEqual({
      title: 'Call the dentist',
      due: '2026-11-10',
    })
    expect(readDueDay('Water the plants today', today, 'en')?.due).toBe(
      '2026-11-09',
    )
    expect(readDueDay('Pay rent tmrw.', today, 'en')).toEqual({
      title: 'Pay rent',
      due: '2026-11-10',
    })
  })

  it('takes a weekday as the next one to come, never today', () => {
    expect(readDueDay('Pay rent fri', today, 'en')?.due).toBe('2026-11-13')
    expect(readDueDay('Gym on Monday', today, 'en')).toEqual({
      title: 'Gym',
      due: '2026-11-16',
    })
    expect(readDueDay('Book tickets Sunday', today, 'en')?.due).toBe(
      '2026-11-15',
    )
  })

  it('reads Hungarian and Slovak, with their case endings and prepositions', () => {
    expect(readDueDay('Fogorvos holnap', today, 'hu')).toEqual({
      title: 'Fogorvos',
      due: '2026-11-10',
    })
    expect(readDueDay('Lakbér pénteken', today, 'hu')?.due).toBe('2026-11-13')
    expect(readDueDay('Bevásárlás holnapután', today, 'hu')?.due).toBe(
      '2026-11-11',
    )
    expect(readDueDay('Zubár zajtra', today, 'sk')).toEqual({
      title: 'Zubár',
      due: '2026-11-10',
    })
    expect(readDueDay('Nájom v piatok', today, 'sk')).toEqual({
      title: 'Nájom',
      due: '2026-11-13',
    })
    expect(readDueDay('Tréning vo štvrtok', today, 'sk')?.due).toBe(
      '2026-11-12',
    )
    // English works in every language.
    expect(readDueDay('Zubár tomorrow', today, 'sk')?.due).toBe('2026-11-10')
  })

  it('leaves titles alone when the day word is not a date at their end', () => {
    expect(readDueDay('Tomorrow', today, 'en')).toBeNull()
    expect(readDueDay('Monday meeting notes', today, 'en')).toBeNull()
    expect(readDueDay('Read Tomorrowland', today, 'en')).toBeNull()
    expect(readDueDay('Visit grandma', today, 'hu')).toBeNull()
    // Another language's words only count in that language.
    expect(readDueDay('Fogorvos holnap', today, 'en')).toBeNull()
  })

  it('crosses months and years', () => {
    expect(readDueDay('Party tomorrow', '2026-12-31', 'en')?.due).toBe(
      '2027-01-01',
    )
    expect(readDueDay('Party fri', '2027-02-27', 'en')?.due).toBe('2027-03-05')
  })
})
