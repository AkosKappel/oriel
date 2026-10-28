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
      b.priority - a.priority || newestFirst(a.created_at, b.created_at),
  )
  completed.sort((a, b) => newestFirst(a.completed_at, b.completed_at))

  return { pinned, open, completed }
}

/** Open tasks in one state; done tasks have left every state. Without a status, everything. */
export function withStatus(items: Item[], status?: TaskStatus) {
  if (!status) return items
  return items.filter(
    (item) =>
      item.type === 'task' && item.status === status && !item.completed_at,
  )
}

export const views = ['archive', 'trash'] as const
export type View = (typeof views)[number]

/** Days an item stays in the trash before devices delete it for good. */
export const trashDays = 30

/**
 * The items one view shows: home has neither archived nor trashed items, the archive the archived
 * ones that are not in the trash, the trash everything deleted, most recent first.
 */
export function itemsInView(items: Item[], view?: View) {
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
  return items.filter((item) => !item.archived_at && !item.deleted_at)
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
