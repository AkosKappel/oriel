import { z } from 'zod'
import { organizeItems, sortEntries } from './organize'
import { type Entry, entrySchema, type Item, itemSchema } from './schema'

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
    .map((item) => itemToText(item, byItem.get(item.id) ?? [], '## '))
    .join('\n\n')}\n`
}

/**
 * One item as text, for sharing into a chat or another app: the title, its text, then list
 * entries as Markdown checkboxes in list order.
 */
export function itemToText(item: Item, entries: Entry[], heading = '') {
  const done = item.completed_at ? 'x' : ' '
  const title =
    item.type === 'task'
      ? `${heading}[${done}] ${item.title}`
      : `${heading}${item.title}`
  const lines = sortEntries(entries).map(
    (entry) => `- [${entry.completed_at ? 'x' : ' '}] ${entry.text}`,
  )
  return [title, item.body.trim(), lines.join('\n')]
    .filter(Boolean)
    .join('\n\n')
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

// Exports written before archive and trash existed have no such fields.
const importedItemSchema = itemSchema.extend({
  archived_at: z.string().nullish().default(null),
  deleted_at: z.string().nullish().default(null),
  deleted_by: z.string().nullish().default(null),
  entries: z.array(entrySchema).default([]),
})

export type ImportedItem = z.output<typeof importedItemSchema>

const exportFileSchema = z.object({
  app: z.literal('oriel'),
  version: z.literal(1),
  items: z.array(z.unknown()),
})

/**
 * Reads a JSON export. Throws when the file is not an Oriel export at all; items that do not
 * match the format are left out and counted, so one damaged item does not lose the rest.
 */
export function parseExport(text: string) {
  const file = exportFileSchema.parse(JSON.parse(text))
  const items: ImportedItem[] = []
  let invalid = 0
  for (const raw of file.items) {
    const result = importedItemSchema.safeParse(raw)
    if (result.success) items.push(result.data)
    else invalid += 1
  }
  return { items, invalid }
}
