import { describe, expect, it } from 'vitest'
import { describeDue, greeting, localDay } from './dates'

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

describe('localDay', () => {
  it('writes the device day with padded month and day', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('describeDue', () => {
  const today = '2026-10-28'

  it('names today and tomorrow', () => {
    expect(describeDue(today, today)).toBe('Due today')
    expect(describeDue('2026-10-29', today)).toBe('Due tomorrow')
  })

  it('crosses month ends', () => {
    expect(describeDue('2026-11-01', '2026-10-31')).toBe('Due tomorrow')
  })

  it('gives the date for later and overdue days', () => {
    expect(describeDue('2026-11-03', today)).toBe('Due 3 November')
    expect(describeDue('2026-10-27', today)).toBe('Overdue since 27 October')
  })
})
