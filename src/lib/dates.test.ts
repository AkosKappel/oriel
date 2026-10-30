import { describe, expect, it } from 'vitest'
import { describeDue, greeting, localDay, nextDue } from './dates'

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

describe('nextDue', () => {
  it('moves a task on by one step from its due day', () => {
    expect(nextDue('2026-10-30', 'daily', '2026-10-30')).toBe('2026-10-31')
    expect(nextDue('2026-10-30', 'weekly', '2026-10-30')).toBe('2026-11-06')
    expect(nextDue('2026-12-15', 'monthly', '2026-12-15')).toBe('2027-01-15')
    // Finished early: the next one still follows the due day.
    expect(nextDue('2026-11-02', 'weekly', '2026-10-30')).toBe('2026-11-09')
  })

  it('skips ahead past today when finished late, keeping the weekday', () => {
    expect(nextDue('2026-10-01', 'weekly', '2026-10-30')).toBe('2026-11-05')
    expect(nextDue('2026-10-20', 'daily', '2026-10-30')).toBe('2026-10-31')
  })

  it('counts from today without a due day', () => {
    expect(nextDue(null, 'weekly', '2026-10-30')).toBe('2026-11-06')
  })

  it('keeps the day of the month, or the last day of a shorter month', () => {
    expect(nextDue('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28')
    expect(nextDue('2026-01-31', 'monthly', '2026-03-01')).toBe('2026-03-31')
    expect(nextDue('2028-01-31', 'monthly', '2028-01-31')).toBe('2028-02-29')
  })
})
