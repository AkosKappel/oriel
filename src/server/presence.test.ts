import { describe, expect, it } from 'vitest'
import { connectionsOf, join } from './presence'

describe('presence', () => {
  it('tells everyone on an item who else is there, once per person', () => {
    const seen: Record<string, string[]> = {}
    const viewer = (key: string, userId: string, name: string) => ({
      userId,
      name,
      send: (others: string[]) => {
        seen[key] = others
      },
    })

    const leaveAnna = join('list', viewer('anna', 'u-anna', 'Anna'))
    expect(seen.anna).toEqual([])
    join('list', viewer('ben', 'u-ben', 'Ben'))
    const leaveBenPhone = join('list', viewer('ben-phone', 'u-ben', 'Ben'))
    join('other', viewer('cleo', 'u-cleo', 'Cleo'))

    expect(seen.anna).toEqual(['Ben'])
    expect(seen.ben).toEqual(['Anna'])
    expect(seen.cleo).toEqual([])
    expect(connectionsOf('u-ben')).toBe(2)

    leaveBenPhone()
    expect(seen.anna).toEqual(['Ben'])
    leaveAnna()
    expect(seen.ben).toEqual([])
  })
})
