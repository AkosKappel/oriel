const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const shortFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
})

/** "Tuesday, 27 October" */
export const formatDay = (date: Date) => dayFormat.format(date)

/** "27 October" */
export const formatShortDate = (iso: string) =>
  shortFormat.format(new Date(iso))

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
})

/** "14:05" today, "27 October" before. */
export function formatWhen(iso: string, now = new Date()) {
  const date = new Date(iso)
  return localDay(date) === localDay(now)
    ? timeFormat.format(date)
    : shortFormat.format(date)
}

/** The device's calendar day as `YYYY-MM-DD`, the form due dates are stored in. */
export function localDay(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "Due today", "Due tomorrow", "Due 3 November", or "Overdue since 27 October". */
export function describeDue(due: string, today: string) {
  if (due === today) return 'Due today'
  // Noon, so a daylight saving change cannot move the day.
  const day = new Date(`${due}T12:00:00`)
  const tomorrow = new Date(`${today}T12:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (due === localDay(tomorrow)) return 'Due tomorrow'
  const date = shortFormat.format(day)
  return due < today ? `Overdue since ${date}` : `Due ${date}`
}

export function greeting(date: Date) {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}
