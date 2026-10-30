import type { ActivitySentence } from '#/lib/activity'
import { formatLocale } from '#/lib/locale'
import { m } from '#/paraglide/messages.js'
import type { Locale } from '#/paraglide/runtime.js'

// What notifications say and when it is morning: pure, so it is tested without a server.

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
export function reminderMessage(titles: string[], locale: Locale = 'en') {
  if (titles.length === 0) return null
  const shown = titles.slice(0, 3)
  const more = titles.length - shown.length
  const body =
    more > 0
      ? m.activity_more({ list: shown.join(', '), count: more }, { locale })
      : new Intl.ListFormat(formatLocale(locale), {
          type: 'conjunction',
        }).format(shown)
  return {
    title: m.push_tasks_title({ count: titles.length }, { locale }),
    body,
    url: '/app?type=task&due=today',
  }
}

/** Only these changes are worth a notification: what was added, and what was checked off. */
export const noticedActions = ['added', 'completed'] as const

const sentence = ({ before, title, after }: ActivitySentence) =>
  [before, title, after].filter(Boolean).join(' ')

/**
 * The notification for other members' changes, newest first ("Anna added Milk and Eggs to
 * Groceries"); null when there is nothing. One change opens its item, several open the notebook.
 */
export function changesMessage(
  sentences: ActivitySentence[],
  locale: Locale = 'en',
) {
  const [first] = sentences
  if (!first) return null
  if (sentences.length === 1) {
    return {
      title: first.title,
      body: sentence(first),
      url: `/items/${first.itemId}`,
    }
  }
  const more = sentences.length - 2
  const shown = sentences.slice(0, 2).map(sentence).join('. ')
  return {
    title: m.push_changes_title({ count: sentences.length }, { locale }),
    body: `${more > 0 ? m.push_and_more({ text: shown, count: more }, { locale }) : shown}.`,
    url: '/app',
  }
}
