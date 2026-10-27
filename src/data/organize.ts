import type { Entry, Item, ItemType } from './schema'

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
const fold = (text: string) =>
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
