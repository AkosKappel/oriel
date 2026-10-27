import { describe, expect, it } from 'vitest'
import { greeting } from './dates'

const at = (hour: number) => new Date(2026, 9, 27, hour, 30)

describe('greeting', () => {
  it('follows the time of day, with the small hours counted as evening', () => {
    expect(greeting(at(4))).toBe('Good evening')
    expect(greeting(at(5))).toBe('Good morning')
    expect(greeting(at(11))).toBe('Good morning')
    expect(greeting(at(12))).toBe('Good afternoon')
    expect(greeting(at(17))).toBe('Good afternoon')
    expect(greeting(at(18))).toBe('Good evening')
  })
})
