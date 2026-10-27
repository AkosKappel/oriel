import { describe, expect, it } from 'vitest'
import { sharedNote } from './share'

describe('sharedNote', () => {
  it('uses the title and keeps the text and link in the body', () => {
    expect(
      sharedNote({
        title: 'Slow bread',
        text: 'Try this weekend',
        url: 'https://example.com/bread',
      }),
    ).toEqual({
      type: 'note',
      title: 'Slow bread',
      body: 'Try this weekend\n\nhttps://example.com/bread',
    })
  })

  it('uses a link shared as text (Android) as the title', () => {
    expect(sharedNote({ text: 'https://example.com' })).toEqual({
      type: 'note',
      title: 'https://example.com',
      body: '',
    })
  })

  it('does not repeat the link when text and url are the same', () => {
    expect(
      sharedNote({ text: 'https://example.com', url: 'https://example.com' }),
    ).toMatchObject({ title: 'https://example.com', body: '' })
  })

  it('splits multi-line text into a title and a body', () => {
    expect(sharedNote({ text: 'Wifi\nPassword on the fridge' })).toMatchObject({
      title: 'Wifi',
      body: 'Password on the fridge',
    })
  })

  it('shortens a title that is too long', () => {
    const note = sharedNote({ title: 'x'.repeat(300) })
    expect(note?.title).toHaveLength(200)
    expect(note?.title.endsWith('…')).toBe(true)
  })

  it('returns null when nothing usable was shared', () => {
    expect(sharedNote({})).toBeNull()
    expect(sharedNote({ title: '  ', text: '\n' })).toBeNull()
  })
})
