// What a morning reminder says and when it is morning: pure, so it is tested without a server.

/** The day and hour at `now` in a time zone, or null for a zone this server does not know. */
export function localClock(now: Date, timeZone: string) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(now)
        .map(({ type, value }) => [type, value]),
    )
    return {
      day: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour),
    }
  } catch {
    return null
  }
}

/** The notification for these task titles, soonest first; null when there is nothing. */
export function reminderMessage(titles: string[]) {
  if (titles.length === 0) return null
  const shown = titles.slice(0, 3)
  const more = titles.length - shown.length
  const body =
    more > 0
      ? `${shown.join(', ')} and ${more} more`
      : shown.length > 1
        ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`
        : shown[0]
  return {
    title:
      titles.length === 1
        ? 'A task for today'
        : `${titles.length} tasks for today`,
    body,
    url: '/app?type=task&due=today',
  }
}
