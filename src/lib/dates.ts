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

export function greeting(date: Date) {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}
