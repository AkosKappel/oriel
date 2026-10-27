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

export function countEntries(entries: Entry[]) {
  const counts = new Map<string, { total: number; open: number }>()
  for (const entry of entries) {
    const count = counts.get(entry.item_id) ?? { total: 0, open: 0 }
    count.total += 1
    if (!entry.completed_at) count.open += 1
    counts.set(entry.item_id, count)
  }
  return counts
}
