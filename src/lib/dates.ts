import type { Repeat } from '#/data/schema'
import { formatLocale } from '#/lib/locale'
import { m } from '#/paraglide/messages.js'

// Formats follow the language (`formatLocale`); one formatter per language and shape, made on
// first use.
const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(shape: 'day' | 'short' | 'time') {
  const locale = formatLocale()
  const key = `${locale} ${shape}`
  let format = formatters.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(
      locale,
      shape === 'day'
        ? { weekday: 'long', day: 'numeric', month: 'long' }
        : shape === 'short'
          ? { day: 'numeric', month: 'long' }
          : { hour: '2-digit', minute: '2-digit' },
    )
    formatters.set(key, format)
  }
  return format
}

/** "Tuesday 27 October" */
export const formatDay = (date: Date) => formatter('day').format(date)

/** "27 October" */
export const formatShortDate = (iso: string) =>
  formatter('short').format(new Date(iso))

/** "30 October, 14:05" */
export function formatDateTime(iso: string) {
  const date = new Date(iso)
  return `${formatter('short').format(date)}, ${formatter('time').format(date)}`
}

/** "14:05" today, "27 October" before. */
export function formatWhen(iso: string, now = new Date()) {
  const date = new Date(iso)
  return localDay(date) === localDay(now)
    ? formatter('time').format(date)
    : formatter('short').format(date)
}

/** The device's calendar day as `YYYY-MM-DD`, the form due dates are stored in. */
export function localDay(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "Due today", "Due tomorrow", "Due 3 November", or "Overdue since 27 October". */
export function describeDue(due: string, today: string) {
  if (due === today) return m.due_today()
  // Noon, so a daylight saving change cannot move the day.
  const day = new Date(`${due}T12:00:00`)
  const tomorrow = new Date(`${today}T12:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (due === localDay(tomorrow)) return m.due_tomorrow()
  const date = formatter('short').format(day)
  return due < today ? m.overdue_since({ date }) : m.due_on({ date })
}

/**
 * The next due day of a repeating task finished on `today`: a step on from its due day (or from
 * today without one), and further until it is after today, so a late finish never leaves it
 * overdue. Monthly keeps the day of the month, or takes the month's last day when it is shorter;
 * from then on it follows that day (31 January, 28 February, 28 March), as the original is not
 * stored.
 */
export function nextDue(
  due: string | null,
  repeat: Repeat,
  today: string,
): string {
  const [year, month, day] = (due ?? today).split('-').map(Number)
  for (let step = 1; ; step++) {
    // Noon UTC, so no time zone or daylight saving change moves the day.
    const next =
      repeat === 'monthly'
        ? new Date(
            Date.UTC(
              year,
              month - 1 + step,
              Math.min(
                day,
                new Date(Date.UTC(year, month + step, 0)).getUTCDate(),
              ),
              12,
            ),
          )
        : new Date(
            Date.UTC(
              year,
              month - 1,
              day + step * (repeat === 'weekly' ? 7 : 1),
              12,
            ),
          )
    const value = next.toISOString().slice(0, 10)
    if (value > today) return value
  }
}

/** The days to snooze until, from `today`: tomorrow, next Monday, and a month on. */
export function snoozeDays(today: string) {
  const [year, month, day] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  const daysToMonday = (8 - weekday) % 7 || 7
  const nextMonday = new Date(Date.UTC(year, month - 1, day + daysToMonday, 12))
  return {
    tomorrow: nextDue(today, 'daily', today),
    nextWeek: nextMonday.toISOString().slice(0, 10),
    nextMonth: nextDue(today, 'monthly', today),
  }
}

export function greeting(date: Date) {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return m.greeting_morning()
  if (hour >= 12 && hour < 18) return m.greeting_afternoon()
  return m.greeting_evening()
}
