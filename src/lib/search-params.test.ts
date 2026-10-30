import { describe, expect, it } from 'vitest'
import { flag, oneOf, text, uuid } from './search-params'

describe('search params', () => {
  it('reads expected values and leaves anything else unset', () => {
    expect(oneOf(['note', 'list'] as const, 'list')).toBe('list')
    expect(oneOf(['note', 'list'] as const, 'event')).toBeUndefined()
    expect(text('milk')).toBe('milk')
    expect(text('x'.repeat(201), 200)).toBeUndefined()
    expect(text(42)).toBeUndefined()
    expect(uuid('0b3c5d1e-2f4a-4b6c-8d9e-0f1a2b3c4d5e')).toBeDefined()
    expect(uuid('../etc')).toBeUndefined()
    expect(flag(true)).toBe(true)
    expect(flag('true')).toBeUndefined()
  })
})
