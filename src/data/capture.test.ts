import { describe, expect, it } from 'vitest'
import { parseCapture } from './capture'

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
