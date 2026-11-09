import { describe, expect, it } from 'vitest'
import { newItemSchema } from './schema'

const firstError = (input: unknown) =>
  newItemSchema.safeParse(input).error?.issues[0].message

describe('newItemSchema', () => {
  // The capture bar shows these messages as they are, so each limit needs its own words.
  it('explains every limit in words of its own', () => {
    expect(
      firstError({ type: 'list', title: 'Big', entries: Array(501).fill('Milk') }),
    ).toBe('A list can hold up to 500 items')
    expect(
      firstError({ type: 'list', title: 'Long', entries: ['x'.repeat(501)] }),
    ).toBe('Keep each item under 500 characters')
    expect(
      firstError({ type: 'note', title: 'Essay', body: 'x'.repeat(20_001) }),
    ).toBe('Keep the text under 20,000 characters')
  })
})
