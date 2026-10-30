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

const entryVerbs: Partial<Record<ActivityAction, [string, string]>> = {
  added: ['added', 'to'],
  completed: ['checked', 'in'],
  reopened: ['unchecked', 'in'],
  edited: ['changed', 'in'],
}

const itemVerbs: Record<ActivityAction, [string, string]> = {
  added: ['added', ''],
  edited: ['edited', ''],
  completed: ['finished', ''],
  reopened: ['reopened', ''],
  archived: ['archived', ''],
  unarchived: ['took', 'out of the archive'],
  trashed: ['moved', 'to the trash'],
  restored: ['restored', ''],
}

function listOf(texts: string[]) {
  const shown = texts.slice(0, 3)
  const more = texts.length - shown.length
  if (more > 0) return `${shown.join(', ')} and ${more} more`
  return shown.length > 1
    ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`
    : shown[0]
}

/**
 * Turns the newest-first log into sentences, joining runs of the same change by the same member
 * to the same list ("Anna checked Milk, Eggs and 2 more in Groceries").
 */
export function describeActivity(lines: ActivityLine[]): ActivitySentence[] {
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
    const who = first.memberName ?? 'Someone who left'
    const texts = [
      ...new Set(run.map((line) => line.entryText).filter((t) => t !== null)),
    ].reverse()
    const entryVerb = entryVerbs[first.action]
    const [verb, after] =
      texts.length > 0 && entryVerb
        ? [`${entryVerb[0]} ${listOf(texts)} ${entryVerb[1]}`, '']
        : itemVerbs[first.action]
    return {
      key: first.id,
      at: first.at,
      before: `${who} ${verb}`,
      itemId: first.itemId,
      title: first.itemTitle,
      after,
    }
  })
}
