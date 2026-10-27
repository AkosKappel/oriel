import { organizeItems, sortEntries } from './organize'
import type { Entry, Item } from './schema'

function entriesByItem(entries: Entry[]) {
  const byItem = new Map<string, Entry[]>()
  for (const entry of sortEntries(entries)) {
    byItem.set(entry.item_id, [...(byItem.get(entry.item_id) ?? []), entry])
  }
  return byItem
}

/** Everything on this device in one file: items with their entries nested, in home order. */
export function toJson(items: Item[], entries: Entry[], exportedAt: Date) {
  const byItem = entriesByItem(entries)
  const { pinned, open, completed } = organizeItems(items)
  return JSON.stringify(
    {
      app: 'oriel',
      version: 1,
      exported_at: exportedAt.toISOString(),
      items: [...pinned, ...open, ...completed].map((item) => ({
        ...item,
        entries: byItem.get(item.id) ?? [],
      })),
    },
    null,
    2,
  )
}

/**
 * A readable copy for any notes app: one heading per item, list entries as Markdown checkboxes.
 * The trash is left out; archived items are in.
 */
export function toMarkdown(items: Item[], entries: Entry[]) {
  const byItem = entriesByItem(entries)
  const { pinned, open, completed } = organizeItems(
    items.filter((item) => !item.deleted_at),
  )
  return `${[...pinned, ...open, ...completed]
    .map((item) => {
      const done = item.completed_at ? 'x' : ' '
      const heading =
        item.type === 'task' ? `## [${done}] ${item.title}` : `## ${item.title}`
      const lines = (byItem.get(item.id) ?? []).map(
        (entry) => `- [${entry.completed_at ? 'x' : ' '}] ${entry.text}`,
      )
      return [heading, item.body.trim(), lines.join('\n')]
        .filter(Boolean)
        .join('\n\n')
    })
    .join('\n\n')}\n`
}

/** Hands a file to the browser's download, which also works offline. */
export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Some browsers start the download after this tick; revoking at once can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
