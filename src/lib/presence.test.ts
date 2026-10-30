import { describe, expect, it } from 'vitest'
import { presenceText } from './presence'

describe('presenceText', () => {
  it('names who else is here', () => {
    expect(presenceText([])).toBeNull()
    expect(presenceText(['Anna'])).toBe('Anna is here too')
    expect(presenceText(['Anna', 'Ben', 'Cleo'])).toBe(
      'Anna, Ben and Cleo are here too',
    )
  })
})
