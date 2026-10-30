import { formatLocale } from '#/lib/locale'
import { m } from '#/paraglide/messages.js'
import { getLocale, type Locale } from '#/paraglide/runtime.js'
import type { ActivityAction } from '#/server/db/schema'

export type ActivityLine = {
  id: string
  action: ActivityAction
  at: string
  userId: string | null
  memberName: string | null
  itemId: string
  itemTitle: string
  entryText: string | null
}

/** A sentence around the item's title, so the title can be a link. */
export type ActivitySentence = {
  key: string
  at: string
  before: string
  itemId: string
  title: string
  after: string
}

// Actions an entry can have; the rest are about the item itself.
const entryActions: ActivityAction[] = [
  'added',
  'completed',
  'reopened',
  'edited',
]

function listOf(texts: string[], locale: Locale) {
  const shown = texts.slice(0, 3)
  const more = texts.length - shown.length
  if (more > 0) {
    return m.activity_more({ list: shown.join(', '), count: more }, { locale })
  }
  return new Intl.ListFormat(formatLocale(locale), {
    type: 'conjunction',
  }).format(shown)
}

/**
 * Turns the newest-first log into sentences, joining runs of the same change by the same member
 * to the same list ("Anna checked Milk, Eggs and 2 more in Groceries").
 */
export function describeActivity(
  lines: ActivityLine[],
  // Notifications are worded in the device's language, outside any request.
  locale: Locale = getLocale(),
): ActivitySentence[] {
  const runs: ActivityLine[][] = []
  for (const line of lines) {
    const run = runs.at(-1)
    const first = run?.[0]
    if (
      first &&
      first.userId === line.userId &&
      first.itemId === line.itemId &&
      first.action === line.action &&
      (first.entryText === null) === (line.entryText === null)
    ) {
      run.push(line)
    } else {
      runs.push([line])
    }
  }

  return runs.map((run) => {
    const [first] = run
    const who = first.memberName ?? m.someone_who_left({}, { locale })
    const texts = [
      ...new Set(run.map((line) => line.entryText).filter((t) => t !== null)),
    ].reverse()
    const { action } = first
    const [before, after] =
      texts.length > 0 && entryActions.includes(action)
        ? [
            m.activity_entry_before(
              { action, who, entries: listOf(texts, locale) },
              { locale },
            ),
            m.activity_entry_after(
              { action, entries: listOf(texts, locale) },
              { locale },
            ),
          ]
        : [
            m.activity_item_before({ action, who }, { locale }),
            m.activity_item_after({ action }, { locale }),
          ]
    return {
      key: first.id,
      at: first.at,
      before,
      itemId: first.itemId,
      title: first.itemTitle,
      after,
    }
  })
}
