import { localDay } from '#/lib/dates'
import type { Entry, Item, ItemType, TaskStatus } from './schema'

export type OrganizedItems = { pinned: Item[]; open: Item[]; completed: Item[] }

const newestFirst = (a: string | null, b: string | null) =>
  (b ?? '').localeCompare(a ?? '')

/**
 * Splits items into the home sections. Completed tasks always go to their own section, even when
 * pinned, so the top of the screen only shows what still needs attention.
 */
export function organizeItems(items: Item[], type?: ItemType): OrganizedItems {
  const pinned: Item[] = []
  const open: Item[] = []
  const completed: Item[] = []

  for (const item of items) {
    if (type && item.type !== type) continue
    if (item.completed_at) completed.push(item)
    else if (item.pinned_at) pinned.push(item)
    else open.push(item)
  }

  pinned.sort((a, b) => newestFirst(a.pinned_at, b.pinned_at))
  open.sort(
    (a, b) =>
      soonestDue(a.due_on, b.due_on) ||
      b.priority - a.priority ||
      newestFirst(since(a), since(b)),
  )
  completed.sort((a, b) => newestFirst(a.completed_at, b.completed_at))

  return { pinned, open, completed }
}

/** A snoozed item counts as new on the day it comes back, so it returns near the top. */
const since = (item: Item) =>
  item.snoozed_until && item.snoozed_until > item.created_at
    ? item.snoozed_until
    : item.created_at

/** Earlier days first; anything without a day after everything with one. */
function soonestDue(a: string | null, b: string | null) {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

export const dueFilters = ['today', 'upcoming'] as const
export type DueFilter = (typeof dueFilters)[number]

/**
 * Open tasks due by `today` (overdue ones included) or after it. Days compare as text, which
 * works because they are written `YYYY-MM-DD`. Without a filter, everything.
 */
export function withDue(
  items: Item[],
  due: DueFilter | undefined,
  today: string,
) {
  if (!due) return items
  return items.filter(
    (item) =>
      item.type === 'task' &&
      !item.completed_at &&
      item.due_on !== null &&
      (due === 'today' ? item.due_on <= today : item.due_on > today),
  )
}

/** Open tasks in one state; done tasks have left every state. Without a status, everything. */
export function withStatus(items: Item[], status?: TaskStatus) {
  if (!status) return items
  return items.filter(
    (item) =>
      item.type === 'task' && item.status === status && !item.completed_at,
  )
}

/** Open tasks for one member. Without a member, everything. */
export function assignedTo(items: Item[], userId?: string) {
  if (!userId) return items
  return items.filter(
    (item) =>
      item.type === 'task' && item.assigned_to === userId && !item.completed_at,
  )
}

export const views = ['snoozed', 'archive', 'trash'] as const
export type View = (typeof views)[number]

/** Days an item stays in the trash before devices delete it for good. */
export const trashDays = 30

const isSnoozed = (item: Item, today: string) =>
  item.snoozed_until !== null && item.snoozed_until > today

/**
 * The items one view shows: home has no snoozed, archived or trashed items; snoozed the ones put
 * off past today, soonest back first; the archive the archived ones that are not in the trash;
 * the trash everything deleted, most recent first.
 */
export function itemsInView(
  items: Item[],
  view?: View,
  today = localDay(new Date()),
) {
  if (view === 'trash') {
    return items
      .filter((item) => item.deleted_at)
      .sort((a, b) => newestFirst(a.deleted_at, b.deleted_at))
  }
  if (view === 'archive') {
    return items
      .filter((item) => item.archived_at && !item.deleted_at)
      .sort((a, b) => newestFirst(a.archived_at, b.archived_at))
  }
  const active = items.filter((item) => !item.archived_at && !item.deleted_at)
  if (view === 'snoozed') {
    return active
      .filter((item) => isSnoozed(item, today))
      .sort((a, b) => soonestDue(a.snoozed_until, b.snoozed_until))
  }
  return active.filter((item) => !isSnoozed(item, today))
}

/** Open entries in list order, then checked ones in the order they were checked. */
export function sortEntries(entries: Entry[]) {
  return [...entries].sort((a, b) => {
    if (!a.completed_at !== !b.completed_at) return a.completed_at ? 1 : -1
    if (a.completed_at && b.completed_at) {
      return a.completed_at.localeCompare(b.completed_at)
    }
    return a.position - b.position || a.created_at.localeCompare(b.created_at)
  })
}

/**
 * The position that puts `entries[from]` at index `to` among the others: halfway between its new
 * neighbours, or one past the end. Only the moved entry changes, so a move syncs as one row.
 */
export function positionForMove(entries: Entry[], from: number, to: number) {
  const others = entries.filter((_, index) => index !== from)
  const before = others[to - 1]?.position
  const after = others[to]?.position
  if (before === undefined && after === undefined) return entries[from].position
  if (before === undefined) return (after as number) - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

/**
 * The first line with text, as plain words: notes are Markdown, but a row on home has no room
 * for headings, emphasis or link targets.
 */
export function previewLine(body: string) {
  const line = body.split('\n').find((text) => text.trim()) ?? ''
  return line
    .trim()
    .replace(/^(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`)(.+?)\1/g, '$2')
    .replace(/([*_])(\S.*?)\1/g, '$2')
}

const previewLength = 3

/** Per list: how many entries, how many still open, and the first few open ones in list order. */
export function countEntries(entries: Entry[]) {
  const counts = new Map<
    string,
    { total: number; open: number; upNext: string[] }
  >()
  for (const entry of sortEntries(entries)) {
    const count = counts.get(entry.item_id) ?? { total: 0, open: 0, upNext: [] }
    count.total += 1
    if (!entry.completed_at) {
      count.open += 1
      if (count.upNext.length < previewLength) count.upNext.push(entry.text)
    }
    counts.set(entry.item_id, count)
  }
  return counts
}

/** Lower case without accents, so "cafe" finds "Café" and "Kávé" finds "kave". */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Where the words of a search query appear in a text, as `[start, end)` positions in the original
 * text, sorted and merged, for highlighting. Matches like `searchItems`: case and accents ignored.
 */
export function matchRanges(text: string, query: string): [number, number][] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  // The folded text, and for each folded character the original character it came from.
  let folded = ''
  const origin: number[] = []
  for (let index = 0; index < text.length; ) {
    const character = String.fromCodePoint(text.codePointAt(index) ?? 0)
    const piece = fold(character)
    // One entry per UTF-16 unit, as `indexOf` counts them: an emoji is two.
    for (let unit = 0; unit < piece.length; unit++) origin.push(index)
    folded += piece
    index += character.length
  }
  // A match ends where the next folded character starts, so trailing combining marks stay in it.
  const endOf = (foldedEnd: number) => origin[foldedEnd] ?? text.length

  const ranges: [number, number][] = []
  for (const word of words) {
    for (
      let at = folded.indexOf(word);
      at !== -1;
      at = folded.indexOf(word, at + 1)
    ) {
      ranges.push([origin[at], endOf(at + word.length)])
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push(range)
  }
  return merged
}

/**
 * Items whose title, text or list entries contain every word of the query, in any order. An empty
 * query keeps everything.
 */
export function searchItems(items: Item[], entries: Entry[], query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return items

  const entryText = new Map<string, string>()
  for (const entry of entries) {
    entryText.set(
      entry.item_id,
      `${entryText.get(entry.item_id) ?? ''}\n${entry.text}`,
    )
  }
  return items.filter((item) => {
    const text = fold(
      `${item.title}\n${item.body}${entryText.get(item.id) ?? ''}`,
    )
    return words.every((word) => text.includes(word))
  })
}

const suggestionLimit = 50

/**
 * Entry texts to offer while adding to a list: everything written in any list before, most used
 * first (then most recent), leaving out what this list already has open. The browser narrows them
 * down as the user types (`<datalist>`).
 */
export function suggestEntries(entries: Entry[], itemId: string) {
  const open = new Set(
    entries
      .filter((entry) => entry.item_id === itemId && !entry.completed_at)
      .map((entry) => fold(entry.text)),
  )
  const used = new Map<string, { text: string; count: number; last: string }>()
  for (const entry of entries) {
    const key = fold(entry.text)
    if (open.has(key)) continue
    const seen = used.get(key)
    if (!seen) {
      used.set(key, { text: entry.text, count: 1, last: entry.created_at })
    } else {
      seen.count += 1
      // The most recent spelling wins ("Oat milk" over an older "oat milk").
      if (entry.created_at > seen.last) {
        seen.text = entry.text
        seen.last = entry.created_at
      }
    }
  }
  return [...used.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, suggestionLimit)
    .map(({ text }) => text)
}
